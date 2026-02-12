/**
 * Story 4.11: Document List Zustand Store
 * Client-side state management with optimistic updates and content type filtering
 */

import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type {
  ContentType,
  LawListItemStatus,
  LawListItemPriority,
  ComplianceStatus,
} from '@prisma/client'
import type {
  VisibilityState,
  ColumnSizingState,
  ColumnOrderState,
} from '@tanstack/react-table'
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
import { DEFAULT_COMPLIANCE_COLUMN_VISIBILITY } from '@/components/features/document-list/compliance-column-settings'

// Story 4.12 & 6.18: View mode type (added 'compliance' for Efterlevnad view)
export type ViewMode = 'card' | 'table' | 'compliance'

// Story 4.14: Cache entry type
export interface ListCacheEntry {
  items: DocumentListItem[]
  total: number // Distinguish genuinely empty list (total=0) from corrupted cache
  fetchedAt: number
}

// Story 4.14: Document info for optimistic item creation
export interface DocumentInfo {
  id: string
  title: string
  documentNumber: string
  contentType: ContentType
  slug: string
  summary?: string | null
}

// ============================================================================
// Types
// ============================================================================

export interface DocumentListState {
  // Data
  lists: DocumentListSummary[]
  activeListId: string | null
  listItems: DocumentListItem[]

  // Story 4.14: Per-list item cache
  itemsByList: Map<string, ListCacheEntry>

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
  columnSizing: ColumnSizingState
  columnOrder: ColumnOrderState
  // Story 6.18: Compliance view column visibility (separate from table view)
  complianceColumnVisibility: VisibilityState
  complianceColumnSizing: ColumnSizingState
  complianceColumnOrder: ColumnOrderState
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

  // Story 4.14: Race condition handling
  fetchAbortController: AbortController | null

  // Errors
  error: string | null

  // Actions
  fetchLists: () => Promise<void>
  setActiveList: (_listId: string) => void
  fetchItems: (
    _reset?: boolean,
    _isBackgroundRefresh?: boolean
  ) => Promise<void>
  loadMoreItems: () => Promise<void>

  // Content type filtering
  setContentTypeFilter: (_filter: ContentType[] | null) => void
  setContentTypeGroupFilter: (_groupId: string | null) => void

  // Optimistic item operations (Story 4.14: True optimistic with DocumentInfo)
  addItem: (
    _listId: string,
    _documentId: string,
    _documentInfo: DocumentInfo,
    _commentary?: string
  ) => Promise<boolean>
  removeItem: (_listItemId: string) => Promise<boolean>
  reorderItems: (
    _items: Array<{ id: string; position: number }>
  ) => Promise<boolean>

  // Story 4.12: Table view actions
  setViewMode: (_mode: ViewMode) => void
  setColumnVisibility: (_visibility: VisibilityState) => void
  setColumnSizing: (_sizing: ColumnSizingState) => void
  setColumnOrder: (_order: ColumnOrderState) => void
  // Story 6.18: Compliance view column visibility
  setComplianceColumnVisibility: (_visibility: VisibilityState) => void
  setComplianceColumnSizing: (_sizing: ColumnSizingState) => void
  setComplianceColumnOrder: (_order: ColumnOrderState) => void
  setSelectedItemIds: (_ids: string[]) => void
  updateItem: (
    _itemId: string,
    _updates: {
      status?: LawListItemStatus
      priority?: LawListItemPriority
      dueDate?: Date | null
      assignedTo?: string | null
      groupId?: string | null
      // Story 6.2: Compliance fields
      complianceStatus?: ComplianceStatus
      responsibleUserId?: string | null
      // Story 6.18: Compliance content fields (optimistic update from modal)
      businessContext?: string | null
      complianceActions?: string | null
    }
  ) => Promise<boolean>
  bulkUpdateItems: (
    _itemIds: string[],
    _updates: {
      status?: LawListItemStatus
      priority?: LawListItemPriority
      complianceStatus?: ComplianceStatus // Story 6.2
      responsibleUserId?: string | null // Story 6.2
    }
  ) => Promise<boolean>

  // Story 4.13: Group actions
  fetchGroups: () => Promise<void>
  setGroupExpanded: (_groupId: string, _expanded: boolean) => void
  toggleGroupExpanded: (_groupId: string) => void
  expandAllGroups: () => void
  collapseAllGroups: () => void
  moveToGroup: (_itemId: string, _groupId: string | null) => Promise<boolean>
  bulkMoveToGroupAction: (
    _itemIds: string[],
    _groupId: string | null
  ) => Promise<boolean>
  // Story 4.13 Task 11: Group filter mode
  setActiveGroupFilter: (_groupId: string | null) => void
  clearGroupFilter: () => void

  // Utilities
  clearError: () => void
  reset: () => void

  // Story 4.14: Cache actions
  getCachedItems: (_listId: string) => DocumentListItem[] | null
  getCachedTotal: (_listId: string) => number | null
  isCacheStale: (_listId: string, _maxAgeMs?: number) => boolean
  setCachedItems: (
    _listId: string,
    _items: DocumentListItem[],
    _total: number
  ) => void
  invalidateListCache: (_listId: string) => void
  updateActiveListCache: () => void

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
  // Story 4.14: Per-list item cache
  itemsByList: new Map<string, ListCacheEntry>(),
  contentTypeFilter: null,
  page: 1,
  limit: 50,
  total: 0,
  hasMore: false,
  // Story 4.12: Table view state
  viewMode: 'card' as ViewMode,
  columnVisibility: DEFAULT_COLUMN_VISIBILITY,
  columnSizing: {} as ColumnSizingState,
  columnOrder: [] as ColumnOrderState,
  // Story 6.18: Compliance view column visibility
  complianceColumnVisibility: DEFAULT_COMPLIANCE_COLUMN_VISIBILITY,
  complianceColumnSizing: {} as ColumnSizingState,
  complianceColumnOrder: [] as ColumnOrderState,
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
  // Story 4.14: Race condition handling
  fetchAbortController: null,
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
            if (!activeId || !lists.find((l) => l.id === activeId)) {
              activeId =
                lists.find((l) => l.isDefault)?.id ?? lists[0]?.id ?? null
            }

            set({
              lists,
              activeListId: activeId,
              isLoadingLists: false,
            })

            // Fetch items for active list
            if (activeId) {
              await get().fetchItems(true)
            }
          } else {
            set({
              error: result.error ?? 'Kunde inte hämta listor',
              isLoadingLists: false,
            })
          }
        } catch (error) {
          console.error('Error fetching lists:', error)
          set({
            error: 'Något gick fel',
            isLoadingLists: false,
          })
        }
      },

      // ========================================================================
      // Set Active List (Story 4.14: Instant switching with cache + abort handling)
      // ========================================================================
      setActiveList: (listId: string) => {
        const {
          activeListId,
          getCachedItems,
          getCachedTotal,
          fetchAbortController,
        } = get()
        if (listId === activeListId) return

        // Story 4.14 Task 7: Abort any pending fetch before starting new one
        if (fetchAbortController) {
          fetchAbortController.abort()
        }

        const cachedItems = getCachedItems(listId)
        const cachedTotal = getCachedTotal(listId)
        // Valid cache: has items, OR is genuinely empty (total === 0)
        const hasValidCache =
          cachedItems !== null && (cachedItems.length > 0 || cachedTotal === 0)

        if (hasValidCache) {
          // Story 4.14: Instant switch from cache - no loading state
          set({
            activeListId: listId,
            listItems: cachedItems,
            total: cachedTotal ?? cachedItems.length,
            page: 1,
            fetchAbortController: null,
          })
          // Only background refresh if cache is stale (>5 min old)
          // This avoids re-render jank from slow API responses (~1-2s)
          if (get().isCacheStale(listId)) {
            get().fetchItems(true, true)
          }
        } else {
          // No cache - show loading state
          set({
            activeListId: listId,
            listItems: [],
            page: 1,
            total: 0,
            hasMore: false,
            isLoadingItems: true,
            fetchAbortController: null,
          })
          // Normal fetch with loading state
          get().fetchItems(true, false)
        }
      },

      // ========================================================================
      // Fetch Items (Story 4.14: Background refresh support)
      // ========================================================================
      fetchItems: async (reset = false, isBackgroundRefresh = false) => {
        const { activeListId, contentTypeFilter, page, limit } = get()

        if (!activeListId) {
          set({ listItems: [], total: 0, hasMore: false })
          return
        }

        // Story 4.14: Track the list ID we're fetching for (stale response detection)
        const listIdBeingFetched = activeListId

        // Only show loading state for non-background fetches
        if (!isBackgroundRefresh) {
          set({ isLoadingItems: true, error: null })
        }

        try {
          const currentPage = reset ? 1 : page

          const result = await getDocumentListItems({
            listId: listIdBeingFetched,
            page: currentPage,
            limit,
            contentTypeFilter: contentTypeFilter ?? undefined,
          })

          // Story 4.14: Check for stale response (user switched lists during fetch)
          if (get().activeListId !== listIdBeingFetched) {
            // Stale response - user switched lists, discard this data
            return
          }

          if (result.success && result.data) {
            const { items, total, hasMore } = result.data

            // Update state
            set({
              listItems: reset ? items : [...get().listItems, ...items],
              total,
              hasMore,
              page: currentPage,
              isLoadingItems: false,
            })

            // Story 4.14: Update cache after successful fetch
            get().setCachedItems(listIdBeingFetched, get().listItems, total)
          } else {
            // Don't show error for background refresh failures
            if (!isBackgroundRefresh) {
              set({
                error: result.error ?? 'Kunde inte hämta dokument',
                isLoadingItems: false,
              })
            } else {
              set({ isLoadingItems: false })
            }
          }
        } catch (error) {
          console.error('Error fetching items:', error)
          // Don't show error for background refresh failures
          if (!isBackgroundRefresh) {
            set({
              error: 'Något gick fel',
              isLoadingItems: false,
            })
          } else {
            set({ isLoadingItems: false })
          }
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
          listItems: [],
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
      // Add Item (Story 4.14: True Optimistic Update)
      // ========================================================================
      addItem: async (
        listId: string,
        documentId: string,
        documentInfo: DocumentInfo,
        commentary?: string
      ) => {
        const { listItems, activeListId } = get()

        // Story 4.14: Create optimistic item with temp ID
        const tempId = `temp-${Date.now()}`
        const tempItem: DocumentListItem = {
          id: tempId,
          position: listItems.length,
          status: 'NOT_STARTED',
          priority: 'MEDIUM',
          commentary: commentary ?? null,
          notes: null,
          addedAt: new Date(),
          dueDate: null,
          assignee: null,
          groupId: null,
          groupName: null,
          // Story 6.2: Compliance fields
          complianceStatus: 'EJ_PABORJAD',
          responsibleUser: null,
          category: null,
          // Story 6.18: Business context and compliance actions
          businessContext: null,
          complianceActions: null,
          complianceActionsUpdatedAt: null,
          complianceActionsUpdatedBy: null,
          updatedAt: new Date(),
          document: {
            id: documentInfo.id,
            title: documentInfo.title,
            documentNumber: documentInfo.documentNumber,
            contentType: documentInfo.contentType,
            slug: documentInfo.slug,
            summary: documentInfo.summary ?? null,
            effectiveDate: null,
            sourceUrl: null,
            status: 'ACTIVE',
          },
        }

        // Story 4.14: Instant UI update - add optimistic item immediately
        // No loading state (isAddingItem: false)
        set({
          listItems: [...listItems, tempItem],
          isAddingItem: false,
          error: null,
        })

        try {
          const result = await addDocumentToList({
            listId,
            documentId,
            commentary,
          })

          if (result.success) {
            // Story 4.14: Update cache with new items
            const currentItems = get().listItems
            if (activeListId === listId) {
              get().setCachedItems(listId, currentItems, get().total + 1)
            }

            // Update list item count
            set((state) => ({
              lists: state.lists.map((l) =>
                l.id === listId ? { ...l, itemCount: l.itemCount + 1 } : l
              ),
              total: state.total + 1,
            }))

            return true
          } else {
            // Story 4.14: Rollback - remove temp item on failure
            set((state) => ({
              listItems: state.listItems.filter((i) => i.id !== tempId),
              error: result.error ?? 'Kunde inte lägga till dokument',
            }))
            return false
          }
        } catch (error) {
          console.error('Error adding item:', error)
          // Story 4.14: Rollback - remove temp item on error
          set((state) => ({
            listItems: state.listItems.filter((i) => i.id !== tempId),
            error: 'Något gick fel',
          }))
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
          listItems: listItems.filter((item) => item.id !== listItemId),
          _rollbackItems: rollbackItems,
        })

        try {
          const result = await removeDocumentFromList(listItemId)

          if (result.success) {
            // Update list item count
            set((state) => ({
              lists: state.lists.map((l) =>
                l.id === activeListId
                  ? { ...l, itemCount: Math.max(0, l.itemCount - 1) }
                  : l
              ),
              total: state.total - 1,
              isRemovingItem: null,
              _rollbackItems: null,
            }))

            // Story 4.14: Update cache after removal
            get().updateActiveListCache()

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
        const positionMap = new Map(items.map((i) => [i.id, i.position]))
        const updatedItems = [...listItems]
          .sort((a, b) => {
            const posA = positionMap.get(a.id) ?? a.position
            const posB = positionMap.get(b.id) ?? b.position
            return posA - posB
          })
          .map((item, idx) => ({
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
            // Story 4.14: Update cache after reorder
            get().updateActiveListCache()
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

      setColumnVisibility: (visibility: VisibilityState) =>
        set({ columnVisibility: visibility }),

      setColumnSizing: (sizing: ColumnSizingState) =>
        set({ columnSizing: sizing }),

      setColumnOrder: (order: ColumnOrderState) => set({ columnOrder: order }),

      // Story 6.18: Compliance view column visibility
      setComplianceColumnVisibility: (visibility: VisibilityState) =>
        set({ complianceColumnVisibility: visibility }),

      setComplianceColumnSizing: (sizing: ColumnSizingState) =>
        set({ complianceColumnSizing: sizing }),

      setComplianceColumnOrder: (order: ColumnOrderState) =>
        set({ complianceColumnOrder: order }),

      setSelectedItemIds: (ids: string[]) => set({ selectedItemIds: ids }),

      // Story 4.14: Optimistic update without refetch
      updateItem: async (
        itemId: string,
        updates: {
          status?: LawListItemStatus
          priority?: LawListItemPriority
          dueDate?: Date | null
          assignedTo?: string | null
          groupId?: string | null
          // Story 6.2: Compliance fields
          complianceStatus?: ComplianceStatus
          responsibleUserId?: string | null
          // Story 6.18: Compliance content fields (optimistic update from modal)
          businessContext?: string | null
          complianceActions?: string | null
        }
      ) => {
        const { listItems, activeListId, groups } = get()

        // Store rollback state
        const rollbackItems = [...listItems]

        // Find group name if updating group
        const groupName =
          updates.groupId !== undefined
            ? (groups.find((g) => g.id === updates.groupId)?.name ?? null)
            : undefined

        // Story 4.14 & 6.2: Optimistic update (no loading state for better UX)
        set({
          isUpdatingItem: itemId,
          listItems: listItems.map((item) =>
            item.id === itemId
              ? {
                  ...item,
                  status: updates.status ?? item.status,
                  priority: updates.priority ?? item.priority,
                  dueDate:
                    updates.dueDate !== undefined
                      ? updates.dueDate
                      : item.dueDate,
                  assignee:
                    updates.assignedTo !== undefined
                      ? updates.assignedTo === null
                        ? null
                        : item.assignee // Keep current if assigning
                      : item.assignee,
                  groupId:
                    updates.groupId !== undefined
                      ? updates.groupId
                      : item.groupId,
                  groupName:
                    groupName !== undefined ? groupName : item.groupName,
                  // Story 6.2: Compliance fields (optimistic update)
                  complianceStatus:
                    updates.complianceStatus !== undefined
                      ? updates.complianceStatus
                      : item.complianceStatus,
                  // For responsibleUser: clear if null, keep existing if assigning
                  // (server will return full user data on next fetch)
                  responsibleUser:
                    updates.responsibleUserId !== undefined
                      ? updates.responsibleUserId === null
                        ? null
                        : item.responsibleUser // Keep existing until server confirms
                      : item.responsibleUser,
                  // Story 6.18: Compliance content fields (optimistic update from modal)
                  businessContext:
                    updates.businessContext !== undefined
                      ? updates.businessContext
                      : item.businessContext,
                  complianceActions:
                    updates.complianceActions !== undefined
                      ? updates.complianceActions
                      : item.complianceActions,
                  // Update timestamp when content changes
                  updatedAt:
                    updates.businessContext !== undefined
                      ? new Date()
                      : item.updatedAt,
                  complianceActionsUpdatedAt:
                    updates.complianceActions !== undefined
                      ? new Date()
                      : item.complianceActionsUpdatedAt,
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
            // Story 4.14: Update cache instead of refetching
            if (activeListId) {
              get().updateActiveListCache()
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
          complianceStatus?: ComplianceStatus // Story 6.2
          responsibleUserId?: string | null // Story 6.2
        }
      ) => {
        const { listItems, activeListId } = get()

        if (!activeListId) return false

        // Store rollback state
        const rollbackItems = [...listItems]

        // Story 4.14 & 6.2: Optimistic update
        set({
          isReordering: true, // Reuse loading state
          listItems: listItems.map((item) =>
            itemIds.includes(item.id)
              ? {
                  ...item,
                  status: updates.status ?? item.status,
                  priority: updates.priority ?? item.priority,
                  complianceStatus:
                    updates.complianceStatus ?? item.complianceStatus,
                  // Story 6.2: Optimistic responsibleUser update
                  responsibleUser:
                    updates.responsibleUserId !== undefined
                      ? updates.responsibleUserId === null
                        ? null
                        : item.responsibleUser // Keep existing until server confirms
                      : item.responsibleUser,
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
            // Story 4.14: Update cache instead of refetching
            get().updateActiveListCache()
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
                    ? (get().groups.find((g) => g.id === groupId)?.name ?? null)
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
            // Story 4.14: Update cache after group move
            get().updateActiveListCache()
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

      bulkMoveToGroupAction: async (
        itemIds: string[],
        groupId: string | null
      ) => {
        const { listItems, activeListId } = get()
        if (!activeListId || itemIds.length === 0) return false

        // Store rollback state
        const rollbackItems = [...listItems]
        const targetGroupName = groupId
          ? (get().groups.find((g) => g.id === groupId)?.name ?? null)
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
            // Story 4.14: Update cache after bulk group move
            get().updateActiveListCache()
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
      // Story 4.14: Cache Actions
      // ========================================================================
      getCachedItems: (listId: string) => {
        const cached = get().itemsByList.get(listId)
        if (!cached) return null
        return cached.items
      },

      getCachedTotal: (listId: string) => {
        const cached = get().itemsByList.get(listId)
        return cached?.total ?? null
      },

      isCacheStale: (listId: string, maxAgeMs = 5 * 60 * 1000) => {
        const cached = get().itemsByList.get(listId)
        if (!cached) return true
        return Date.now() - cached.fetchedAt > maxAgeMs
      },

      setCachedItems: (
        listId: string,
        items: DocumentListItem[],
        total: number
      ) => {
        const cache = new Map(get().itemsByList)
        cache.set(listId, { items, total, fetchedAt: Date.now() })

        // LRU eviction: Keep last 10 lists
        if (cache.size > 10) {
          const oldest = [...cache.entries()].sort(
            (a, b) => a[1].fetchedAt - b[1].fetchedAt
          )[0]
          if (oldest) {
            cache.delete(oldest[0])
          }
        }

        set({ itemsByList: cache })
      },

      invalidateListCache: (listId: string) => {
        const cache = new Map(get().itemsByList)
        cache.delete(listId)
        set({ itemsByList: cache })
      },

      updateActiveListCache: () => {
        const { activeListId, listItems, total } = get()
        if (activeListId) {
          get().setCachedItems(activeListId, listItems, total)
        }
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
        columnSizing: state.columnSizing,
        columnOrder: state.columnOrder,
        // Story 6.18: Persist compliance view preferences
        complianceColumnVisibility: state.complianceColumnVisibility,
        complianceColumnSizing: state.complianceColumnSizing,
        complianceColumnOrder: state.complianceColumnOrder,
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
  state.lists.find((l) => l.id === state.activeListId)

export const selectFilteredItemCount = (state: DocumentListState) => state.total

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

export const selectItemsInGroup =
  (groupId: string | null) => (state: DocumentListState) =>
    state.listItems.filter((item) =>
      groupId === null ? !item.groupId : item.groupId === groupId
    )

export const selectUngroupedItemCount = (state: DocumentListState) =>
  state.listItems.filter((item) => !item.groupId).length

export const selectIsGroupExpanded =
  (groupId: string) => (state: DocumentListState) =>
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
