/**
 * Story 4.11: Document List Zustand Store
 * Client-side state management with optimistic updates and content type filtering
 */

import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { ContentType, LawListItemStatus, LawListItemPriority } from '@prisma/client'
import type { VisibilityState } from '@tanstack/react-table'
import {
  getDocumentLists,
  getDocumentListItems,
  addDocumentToList,
  removeDocumentFromList,
  reorderListItems,
  updateListItem,
  bulkUpdateListItems,
  // Story 4.13: Group actions
  getListGroups,
  moveItemToGroup,
  bulkMoveToGroup,
  type DocumentListSummary,
  type DocumentListItem,
  type ListGroupSummary,
} from '@/app/actions/document-list'
import { getContentTypesForGroup } from '@/lib/utils/content-type'
import { DEFAULT_COLUMN_VISIBILITY } from '@/components/features/document-list/column-settings'

// Story 4.12: View mode type
export type ViewMode = 'card' | 'table'

// ============================================================================
// Types
// ============================================================================

export interface DocumentListState {
  // Data
  lists: DocumentListSummary[]
  activeListId: string | null
  listItems: DocumentListItem[]

  // Filtering
  contentTypeFilter: ContentType[] | null // null = show all

  // Pagination
  page: number
  limit: number
  total: number
  hasMore: boolean

  // Story 4.12: Table view state
  viewMode: ViewMode
  columnVisibility: VisibilityState
  selectedItemIds: string[]

  // Story 4.13: Group state
  groups: ListGroupSummary[]
  expandedGroups: Record<string, boolean> // groupId -> isExpanded (true = expanded)
  activeGroupFilter: string | null // Story 4.13 Task 11: Filter to single group
  isLoadingGroups: boolean
  isMovingItems: boolean

  // Loading states
  isLoadingLists: boolean
  isLoadingItems: boolean
  isAddingItem: boolean
  isRemovingItem: string | null // item ID being removed
  isReordering: boolean
  isUpdatingItem: string | null // Story 4.12: item ID being updated

  // Errors
  error: string | null

  // Actions
  fetchLists: () => Promise<void>
  setActiveList: (_listId: string) => void
  fetchItems: (_reset?: boolean) => Promise<void>
  loadMoreItems: () => Promise<void>

  // Content type filtering
  setContentTypeFilter: (_filter: ContentType[] | null) => void
  setContentTypeGroupFilter: (_groupId: string | null) => void

  // Optimistic item operations
  addItem: (_listId: string, _documentId: string, _commentary?: string) => Promise<boolean>
  removeItem: (_listItemId: string) => Promise<boolean>
  reorderItems: (_items: Array<{ id: string; position: number }>) => Promise<boolean>

  // Story 4.12: Table view actions
  setViewMode: (_mode: ViewMode) => void
  setColumnVisibility: (_visibility: VisibilityState) => void
  setSelectedItemIds: (_ids: string[]) => void
  updateItem: (
    _itemId: string,
    _updates: {
      status?: LawListItemStatus
      priority?: LawListItemPriority
      dueDate?: Date | null
      assignedTo?: string | null
      groupId?: string | null
    }
  ) => Promise<boolean>
  bulkUpdateItems: (
    _itemIds: string[],
    _updates: {
      status?: LawListItemStatus
      priority?: LawListItemPriority
    }
  ) => Promise<boolean>

  // Story 4.13: Group actions
  fetchGroups: () => Promise<void>
  setGroupExpanded: (_groupId: string, _expanded: boolean) => void
  toggleGroupExpanded: (_groupId: string) => void
  expandAllGroups: () => void
  collapseAllGroups: () => void
  moveToGroup: (_itemId: string, _groupId: string | null) => Promise<boolean>
  bulkMoveToGroupAction: (_itemIds: string[], _groupId: string | null) => Promise<boolean>
  // Story 4.13 Task 11: Group filter mode
  setActiveGroupFilter: (_groupId: string | null) => void
  clearGroupFilter: () => void

  // Utilities
  clearError: () => void
  reset: () => void

  // Optimistic update helpers (internal)
  _rollbackItems: DocumentListItem[] | null
}

// ============================================================================
// Initial State
// ============================================================================

const initialState = {
  lists: [],
  activeListId: null,
  listItems: [],
  contentTypeFilter: null,
  page: 1,
  limit: 50,
  total: 0,
  hasMore: false,
  // Story 4.12: Table view state
  viewMode: 'card' as ViewMode,
  columnVisibility: DEFAULT_COLUMN_VISIBILITY,
  selectedItemIds: [] as string[],
  // Story 4.13: Group state
  groups: [] as ListGroupSummary[],
  expandedGroups: {} as Record<string, boolean>,
  activeGroupFilter: null as string | null,
  isLoadingGroups: false,
  isMovingItems: false,
  // Loading states
  isLoadingLists: false,
  isLoadingItems: false,
  isAddingItem: false,
  isRemovingItem: null,
  isReordering: false,
  isUpdatingItem: null,
  error: null,
  _rollbackItems: null,
}

// ============================================================================
// Store
// ============================================================================

export const useDocumentListStore = create<DocumentListState>()(
  persist(
    (set, get) => ({
      ...initialState,

      // ========================================================================
      // Fetch Lists
      // ========================================================================
      fetchLists: async () => {
        set({ isLoadingLists: true, error: null })

        try {
          const result = await getDocumentLists()

          if (result.success && result.data) {
            const lists = result.data
            const currentActiveId = get().activeListId

            // Set active list to first list if not set or if current doesn't exist
            let activeId = currentActiveId
            if (!activeId || !lists.find(l => l.id === activeId)) {
              activeId = lists.find(l => l.isDefault)?.id ?? lists[0]?.id ?? null
            }

            set({
              lists,
              activeListId: activeId,
              isLoadingLists: false
            })

            // Fetch items for active list
            if (activeId) {
              await get().fetchItems(true)
            }
          } else {
            set({
              error: result.error ?? 'Kunde inte hämta listor',
              isLoadingLists: false
            })
          }
        } catch (error) {
          console.error('Error fetching lists:', error)
          set({
            error: 'Något gick fel',
            isLoadingLists: false
          })
        }
      },

      // ========================================================================
      // Set Active List
      // ========================================================================
      setActiveList: (listId: string) => {
        const { activeListId } = get()
        if (listId === activeListId) return

        set({
          activeListId: listId,
          listItems: [],
          page: 1,
          total: 0,
          hasMore: false
        })

        // Fetch items for new list
        get().fetchItems(true)
      },

      // ========================================================================
      // Fetch Items
      // ========================================================================
      fetchItems: async (reset = false) => {
        const { activeListId, contentTypeFilter, page, limit } = get()

        if (!activeListId) {
          set({ listItems: [], total: 0, hasMore: false })
          return
        }

        set({ isLoadingItems: true, error: null })

        try {
          const currentPage = reset ? 1 : page

          const result = await getDocumentListItems({
            listId: activeListId,
            page: currentPage,
            limit,
            contentTypeFilter: contentTypeFilter ?? undefined,
          })

          if (result.success && result.data) {
            const { items, total, hasMore } = result.data

            set({
              listItems: reset ? items : [...get().listItems, ...items],
              total,
              hasMore,
              page: currentPage,
              isLoadingItems: false,
            })
          } else {
            set({
              error: result.error ?? 'Kunde inte hämta dokument',
              isLoadingItems: false
            })
          }
        } catch (error) {
          console.error('Error fetching items:', error)
          set({
            error: 'Något gick fel',
            isLoadingItems: false
          })
        }
      },

      // ========================================================================
      // Load More Items
      // ========================================================================
      loadMoreItems: async () => {
        const { hasMore, isLoadingItems, page } = get()

        if (!hasMore || isLoadingItems) return

        set({ page: page + 1 })
        await get().fetchItems(false)
      },

      // ========================================================================
      // Content Type Filtering
      // ========================================================================
      setContentTypeFilter: (filter: ContentType[] | null) => {
        set({
          contentTypeFilter: filter,
          page: 1,
          listItems: []
        })
        get().fetchItems(true)
      },

      setContentTypeGroupFilter: (groupId: string | null) => {
        if (!groupId || groupId === 'all') {
          get().setContentTypeFilter(null)
        } else {
          const types = getContentTypesForGroup(groupId)
          get().setContentTypeFilter(types.length > 0 ? types : null)
        }
      },

      // ========================================================================
      // Add Item (Optimistic)
      // ========================================================================
      addItem: async (listId: string, documentId: string, commentary?: string) => {
        set({ isAddingItem: true, error: null })

        try {
          const result = await addDocumentToList({
            listId,
            documentId,
            commentary,
          })

          if (result.success) {
            // Refresh items to get the new item with full data
            await get().fetchItems(true)

            // Update list item count
            set(state => ({
              lists: state.lists.map(l =>
                l.id === listId
                  ? { ...l, itemCount: l.itemCount + 1 }
                  : l
              ),
              isAddingItem: false,
            }))

            return true
          } else {
            set({
              error: result.error ?? 'Kunde inte lägga till dokument',
              isAddingItem: false
            })
            return false
          }
        } catch (error) {
          console.error('Error adding item:', error)
          set({
            error: 'Något gick fel',
            isAddingItem: false
          })
          return false
        }
      },

      // ========================================================================
      // Remove Item (Optimistic)
      // ========================================================================
      removeItem: async (listItemId: string) => {
        const { listItems, activeListId } = get()

        // Store rollback state
        const rollbackItems = [...listItems]

        // Optimistic update
        set({
          isRemovingItem: listItemId,
          listItems: listItems.filter(item => item.id !== listItemId),
          _rollbackItems: rollbackItems,
        })

        try {
          const result = await removeDocumentFromList(listItemId)

          if (result.success) {
            // Update list item count
            set(state => ({
              lists: state.lists.map(l =>
                l.id === activeListId
                  ? { ...l, itemCount: Math.max(0, l.itemCount - 1) }
                  : l
              ),
              total: state.total - 1,
              isRemovingItem: null,
              _rollbackItems: null,
            }))

            return true
          } else {
            // Rollback on error
            set({
              listItems: rollbackItems,
              error: result.error ?? 'Kunde inte ta bort dokument',
              isRemovingItem: null,
              _rollbackItems: null,
            })
            return false
          }
        } catch (error) {
          console.error('Error removing item:', error)
          // Rollback on error
          set({
            listItems: rollbackItems,
            error: 'Något gick fel',
            isRemovingItem: null,
            _rollbackItems: null,
          })
          return false
        }
      },

      // ========================================================================
      // Reorder Items (Optimistic with debounce handled by component)
      // ========================================================================
      reorderItems: async (items: Array<{ id: string; position: number }>) => {
        const { listItems, activeListId } = get()

        if (!activeListId) return false

        // Store rollback state
        const rollbackItems = [...listItems]

        // Optimistic update - sort by new positions
        const positionMap = new Map(items.map(i => [i.id, i.position]))
        const updatedItems = [...listItems].sort((a, b) => {
          const posA = positionMap.get(a.id) ?? a.position
          const posB = positionMap.get(b.id) ?? b.position
          return posA - posB
        }).map((item, idx) => ({
          ...item,
          position: positionMap.get(item.id) ?? idx,
        }))

        set({
          isReordering: true,
          listItems: updatedItems,
          _rollbackItems: rollbackItems,
        })

        try {
          const result = await reorderListItems({
            listId: activeListId,
            items,
          })

          if (result.success) {
            set({
              isReordering: false,
              _rollbackItems: null,
            })
            return true
          } else {
            // Rollback on error
            set({
              listItems: rollbackItems,
              error: result.error ?? 'Kunde inte ändra ordning',
              isReordering: false,
              _rollbackItems: null,
            })
            return false
          }
        } catch (error) {
          console.error('Error reordering items:', error)
          // Rollback on error
          set({
            listItems: rollbackItems,
            error: 'Något gick fel',
            isReordering: false,
            _rollbackItems: null,
          })
          return false
        }
      },

      // ========================================================================
      // Story 4.12: Table View Actions
      // ========================================================================
      setViewMode: (mode: ViewMode) => set({ viewMode: mode }),

      setColumnVisibility: (visibility: VisibilityState) => set({ columnVisibility: visibility }),

      setSelectedItemIds: (ids: string[]) => set({ selectedItemIds: ids }),

      updateItem: async (
        itemId: string,
        updates: {
          status?: LawListItemStatus
          priority?: LawListItemPriority
          dueDate?: Date | null
          assignedTo?: string | null
        }
      ) => {
        const { listItems } = get()

        // Store rollback state
        const rollbackItems = [...listItems]

        // Optimistic update
        set({
          isUpdatingItem: itemId,
          listItems: listItems.map((item) =>
            item.id === itemId
              ? {
                  ...item,
                  status: updates.status ?? item.status,
                  priority: updates.priority ?? item.priority,
                  dueDate: updates.dueDate !== undefined ? updates.dueDate : item.dueDate,
                  assignee:
                    updates.assignedTo !== undefined
                      ? updates.assignedTo === null
                        ? null
                        : item.assignee // Keep current if assigning (will refresh)
                      : item.assignee,
                }
              : item
          ),
          _rollbackItems: rollbackItems,
        })

        try {
          const result = await updateListItem({
            listItemId: itemId,
            ...updates,
          })

          if (result.success) {
            // Refresh to get the full assignee data if assignedTo was updated
            if (updates.assignedTo !== undefined) {
              await get().fetchItems(true)
            }
            set({ isUpdatingItem: null, _rollbackItems: null })
            return true
          } else {
            set({
              listItems: rollbackItems,
              error: result.error ?? 'Kunde inte uppdatera',
              isUpdatingItem: null,
              _rollbackItems: null,
            })
            return false
          }
        } catch (error) {
          console.error('Error updating item:', error)
          set({
            listItems: rollbackItems,
            error: 'Något gick fel',
            isUpdatingItem: null,
            _rollbackItems: null,
          })
          return false
        }
      },

      bulkUpdateItems: async (
        itemIds: string[],
        updates: {
          status?: LawListItemStatus
          priority?: LawListItemPriority
        }
      ) => {
        const { listItems, activeListId } = get()

        if (!activeListId) return false

        // Store rollback state
        const rollbackItems = [...listItems]

        // Optimistic update
        set({
          isReordering: true, // Reuse loading state
          listItems: listItems.map((item) =>
            itemIds.includes(item.id)
              ? {
                  ...item,
                  status: updates.status ?? item.status,
                  priority: updates.priority ?? item.priority,
                }
              : item
          ),
          selectedItemIds: [],
          _rollbackItems: rollbackItems,
        })

        try {
          const result = await bulkUpdateListItems({
            listId: activeListId,
            itemIds,
            updates,
          })

          if (result.success) {
            set({ isReordering: false, _rollbackItems: null })
            return true
          } else {
            set({
              listItems: rollbackItems,
              selectedItemIds: itemIds,
              error: result.error ?? 'Kunde inte uppdatera',
              isReordering: false,
              _rollbackItems: null,
            })
            return false
          }
        } catch (error) {
          console.error('Error bulk updating items:', error)
          set({
            listItems: rollbackItems,
            selectedItemIds: itemIds,
            error: 'Något gick fel',
            isReordering: false,
            _rollbackItems: null,
          })
          return false
        }
      },

      // ========================================================================
      // Story 4.13: Group Actions
      // ========================================================================
      fetchGroups: async () => {
        const { activeListId } = get()
        if (!activeListId) {
          set({ groups: [] })
          return
        }

        set({ isLoadingGroups: true })

        try {
          const result = await getListGroups(activeListId)
          if (result.success && result.data) {
            // Initialize expansion state for new groups (default expanded)
            const currentExpanded = get().expandedGroups
            const newExpandedState = { ...currentExpanded }
            result.data.forEach((group) => {
              if (newExpandedState[group.id] === undefined) {
                newExpandedState[group.id] = true // Default to expanded
              }
            })

            set({
              groups: result.data,
              expandedGroups: newExpandedState,
              isLoadingGroups: false,
            })
          } else {
            set({ isLoadingGroups: false })
          }
        } catch (error) {
          console.error('Error fetching groups:', error)
          set({ isLoadingGroups: false })
        }
      },

      setGroupExpanded: (groupId: string, expanded: boolean) => {
        set((state) => ({
          expandedGroups: {
            ...state.expandedGroups,
            [groupId]: expanded,
          },
        }))
      },

      toggleGroupExpanded: (groupId: string) => {
        const { expandedGroups } = get()
        const currentState = expandedGroups[groupId] ?? true
        set({
          expandedGroups: {
            ...expandedGroups,
            [groupId]: !currentState,
          },
        })
      },

      expandAllGroups: () => {
        const { groups } = get()
        const allExpanded: Record<string, boolean> = {}
        groups.forEach((group) => {
          allExpanded[group.id] = true
        })
        // Also expand "ungrouped" section
        allExpanded['__ungrouped__'] = true
        set({ expandedGroups: allExpanded })
      },

      collapseAllGroups: () => {
        const { groups } = get()
        const allCollapsed: Record<string, boolean> = {}
        groups.forEach((group) => {
          allCollapsed[group.id] = false
        })
        allCollapsed['__ungrouped__'] = false
        set({ expandedGroups: allCollapsed })
      },

      moveToGroup: async (itemId: string, groupId: string | null) => {
        const { listItems, activeListId } = get()
        if (!activeListId) return false

        // Store rollback state
        const rollbackItems = [...listItems]

        // Optimistic update
        set({
          isMovingItems: true,
          listItems: listItems.map((item) =>
            item.id === itemId
              ? {
                  ...item,
                  groupId,
                  groupName: groupId
                    ? get().groups.find((g) => g.id === groupId)?.name ?? null
                    : null,
                }
              : item
          ),
          _rollbackItems: rollbackItems,
        })

        try {
          const result = await moveItemToGroup({
            listItemId: itemId,
            groupId,
          })

          if (result.success) {
            // Refresh groups to update item counts
            await get().fetchGroups()
            set({ isMovingItems: false, _rollbackItems: null })
            return true
          } else {
            set({
              listItems: rollbackItems,
              error: result.error ?? 'Kunde inte flytta dokument',
              isMovingItems: false,
              _rollbackItems: null,
            })
            return false
          }
        } catch (error) {
          console.error('Error moving item to group:', error)
          set({
            listItems: rollbackItems,
            error: 'Något gick fel',
            isMovingItems: false,
            _rollbackItems: null,
          })
          return false
        }
      },

      bulkMoveToGroupAction: async (itemIds: string[], groupId: string | null) => {
        const { listItems, activeListId } = get()
        if (!activeListId || itemIds.length === 0) return false

        // Store rollback state
        const rollbackItems = [...listItems]
        const targetGroupName = groupId
          ? get().groups.find((g) => g.id === groupId)?.name ?? null
          : null

        // Optimistic update
        set({
          isMovingItems: true,
          listItems: listItems.map((item) =>
            itemIds.includes(item.id)
              ? { ...item, groupId, groupName: targetGroupName }
              : item
          ),
          selectedItemIds: [],
          _rollbackItems: rollbackItems,
        })

        try {
          const result = await bulkMoveToGroup({
            listId: activeListId,
            itemIds,
            groupId,
          })

          if (result.success) {
            // Refresh groups to update item counts
            await get().fetchGroups()
            set({ isMovingItems: false, _rollbackItems: null })
            return true
          } else {
            set({
              listItems: rollbackItems,
              selectedItemIds: itemIds,
              error: result.error ?? 'Kunde inte flytta dokument',
              isMovingItems: false,
              _rollbackItems: null,
            })
            return false
          }
        } catch (error) {
          console.error('Error bulk moving items to group:', error)
          set({
            listItems: rollbackItems,
            selectedItemIds: itemIds,
            error: 'Något gick fel',
            isMovingItems: false,
            _rollbackItems: null,
          })
          return false
        }
      },

      // ========================================================================
      // Story 4.13 Task 11: Group Filter Mode
      // ========================================================================
      setActiveGroupFilter: (groupId: string | null) => {
        set({ activeGroupFilter: groupId })
      },

      clearGroupFilter: () => {
        set({ activeGroupFilter: null })
      },

      // ========================================================================
      // Utilities
      // ========================================================================
      clearError: () => set({ error: null }),

      reset: () => set(initialState),
    }),
    {
      name: 'document-list-storage',
      partialize: (state) => ({
        activeListId: state.activeListId,
        // Story 4.12: Persist view preferences
        viewMode: state.viewMode,
        columnVisibility: state.columnVisibility,
        // Story 4.13: Persist group expansion state
        expandedGroups: state.expandedGroups,
        // Don't persist lists/items/groups - always fetch fresh
      }),
    }
  )
)

// ============================================================================
// Selectors (for better performance)
// ============================================================================

export const selectActiveList = (state: DocumentListState) =>
  state.lists.find(l => l.id === state.activeListId)

export const selectFilteredItemCount = (state: DocumentListState) =>
  state.total

export const selectIsLoading = (state: DocumentListState) =>
  state.isLoadingLists || state.isLoadingItems

export const selectCanAddDocuments = (state: DocumentListState) =>
  state.activeListId !== null && !state.isAddingItem

// Story 4.13: Group selectors
export const selectGroupedItems = (state: DocumentListState) => {
  const { listItems, groups } = state

  // Group items by groupId
  const grouped: Record<string, DocumentListItem[]> = {}
  const ungrouped: DocumentListItem[] = []

  // Initialize empty arrays for all groups
  groups.forEach((group) => {
    grouped[group.id] = []
  })

  // Distribute items
  listItems.forEach((item) => {
    const groupItems = item.groupId ? grouped[item.groupId] : undefined
    if (groupItems) {
      groupItems.push(item)
    } else {
      ungrouped.push(item)
    }
  })

  return { grouped, ungrouped }
}

export const selectItemsInGroup = (groupId: string | null) => (state: DocumentListState) =>
  state.listItems.filter((item) =>
    groupId === null ? !item.groupId : item.groupId === groupId
  )

export const selectUngroupedItemCount = (state: DocumentListState) =>
  state.listItems.filter((item) => !item.groupId).length

export const selectIsGroupExpanded = (groupId: string) => (state: DocumentListState) =>
  state.expandedGroups[groupId] ?? true // Default to expanded

// Story 4.13 Task 11: Get active group filter info
export const selectActiveGroupFilterInfo = (state: DocumentListState) => {
  const { activeGroupFilter, groups } = state
  if (!activeGroupFilter) return null

  // Handle special "ungrouped" filter
  if (activeGroupFilter === '__ungrouped__') {
    return { id: '__ungrouped__', name: 'Ogrupperade' }
  }

  const group = groups.find((g) => g.id === activeGroupFilter)
  return group ? { id: group.id, name: group.name } : null
}

// Story 4.13 Task 11: Get items filtered by active group filter
export const selectFilteredByGroupItems = (state: DocumentListState) => {
  const { listItems, activeGroupFilter } = state

  if (!activeGroupFilter) return listItems

  if (activeGroupFilter === '__ungrouped__') {
    return listItems.filter((item) => !item.groupId)
  }

  return listItems.filter((item) => item.groupId === activeGroupFilter)
}
