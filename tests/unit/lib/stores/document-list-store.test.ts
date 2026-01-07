/**
 * Story 4.11: Unit Tests for Document List Zustand Store
 */

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest'
import { act } from '@testing-library/react'

// Mock the server actions before importing the store
vi.mock('@/app/actions/document-list', () => ({
  getDocumentLists: vi.fn(),
  getDocumentListItems: vi.fn(),
  addDocumentToList: vi.fn(),
  removeDocumentFromList: vi.fn(),
  reorderListItems: vi.fn(),
  updateListItem: vi.fn(),
  bulkUpdateListItems: vi.fn(),
  // Story 4.13: Group actions
  getListGroups: vi.fn(),
  moveItemToGroup: vi.fn(),
  bulkMoveToGroup: vi.fn(),
}))

// Mock content-type utils
vi.mock('@/lib/utils/content-type', () => ({
  getContentTypesForGroup: vi.fn((groupId: string) => {
    const groups: Record<string, string[]> = {
      laws: ['SFS_LAW'],
      amendments: ['SFS_AMENDMENT'],
      courtCases: ['COURT_CASE_HD', 'COURT_CASE_AD'],
      euDocuments: ['EU_REGULATION', 'EU_DIRECTIVE'],
    }
    return groups[groupId] || []
  }),
}))

import {
  useDocumentListStore,
  selectActiveList,
  selectIsLoading,
  // Story 4.13: Group selectors
  selectGroupedItems,
  selectItemsInGroup,
  selectUngroupedItemCount,
  selectIsGroupExpanded,
  selectActiveGroupFilterInfo,
  selectFilteredByGroupItems,
  // Story 4.14: Cache types
  type ListCacheEntry,
  type DocumentInfo,
} from '@/lib/stores/document-list-store'
import * as actions from '@/app/actions/document-list'
import type {
  DocumentListSummary,
  DocumentListItem,
  ListGroupSummary,
} from '@/app/actions/document-list'

describe('Document List Store', () => {
  const mockLists: DocumentListSummary[] = [
    {
      id: 'list-1',
      name: 'Huvudlista',
      description: 'Default list',
      isDefault: true,
      itemCount: 5,
      createdAt: new Date(),
      updatedAt: new Date(),
    },
    {
      id: 'list-2',
      name: 'GDPR Focus',
      description: null,
      isDefault: false,
      itemCount: 3,
      createdAt: new Date(),
      updatedAt: new Date(),
    },
  ]

  const mockItems: DocumentListItem[] = [
    {
      id: 'item-1',
      position: 0,
      commentary: null,
      status: 'NOT_STARTED',
      priority: 'HIGH',
      notes: null,
      addedAt: new Date(),
      groupId: 'group-1', // Story 4.13: Group assignment
      groupName: 'GDPR Lagar',
      document: {
        id: 'doc-1',
        title: 'Arbetsmiljölag',
        documentNumber: 'SFS 1977:1160',
        contentType: 'SFS_LAW',
        slug: 'sfs-1977-1160',
        summary: null,
        effectiveDate: null,
      },
    },
    {
      id: 'item-2',
      position: 1,
      commentary: 'Important',
      status: 'IN_PROGRESS',
      priority: 'MEDIUM',
      notes: null,
      addedAt: new Date(),
      groupId: null, // Ungrouped
      groupName: null,
      document: {
        id: 'doc-2',
        title: 'HD 2023 ref 45',
        documentNumber: 'HD 2023:45',
        contentType: 'COURT_CASE_HD',
        slug: 'hd-2023-45',
        summary: 'Court case summary',
        effectiveDate: null,
      },
    },
    {
      id: 'item-3',
      position: 2,
      commentary: null,
      status: 'COMPLETED',
      priority: 'LOW',
      notes: null,
      addedAt: new Date(),
      groupId: 'group-1', // Same group as item-1
      groupName: 'GDPR Lagar',
      document: {
        id: 'doc-3',
        title: 'Dataskyddslag',
        documentNumber: 'SFS 2018:218',
        contentType: 'SFS_LAW',
        slug: 'sfs-2018-218',
        summary: null,
        effectiveDate: null,
      },
    },
  ]

  // Story 4.13: Mock groups
  const mockGroups: ListGroupSummary[] = [
    {
      id: 'group-1',
      name: 'GDPR Lagar',
      description: 'GDPR related laws',
      color: '#3b82f6',
      position: 0,
      itemCount: 2,
    },
    {
      id: 'group-2',
      name: 'Arbetsrätt',
      description: 'Labor laws',
      color: '#ef4444',
      position: 1,
      itemCount: 0,
    },
  ]

  beforeEach(() => {
    // Reset the store before each test
    useDocumentListStore.setState({
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
      viewMode: 'card',
      columnVisibility: {},
      selectedItemIds: [],
      // Story 4.13: Group state
      groups: [],
      expandedGroups: {},
      activeGroupFilter: null,
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
    })

    // Reset all mocks
    vi.clearAllMocks()
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  describe('Initial State', () => {
    it('should have correct initial state', () => {
      const state = useDocumentListStore.getState()
      expect(state.lists).toEqual([])
      expect(state.activeListId).toBeNull()
      expect(state.listItems).toEqual([])
      expect(state.contentTypeFilter).toBeNull()
      expect(state.isLoadingLists).toBe(false)
      expect(state.error).toBeNull()
    })
  })

  describe('setActiveList', () => {
    it('should set active list and clear items', async () => {
      // Setup
      vi.mocked(actions.getDocumentListItems).mockResolvedValue({
        success: true,
        data: { items: [], total: 0, hasMore: false },
      })

      useDocumentListStore.setState({
        lists: mockLists,
        activeListId: 'list-1',
        listItems: mockItems,
      })

      // Act
      await act(async () => {
        useDocumentListStore.getState().setActiveList('list-2')
      })

      // Assert
      const state = useDocumentListStore.getState()
      expect(state.activeListId).toBe('list-2')
    })

    it('should not change if same list selected', () => {
      useDocumentListStore.setState({
        activeListId: 'list-1',
        listItems: mockItems,
      })

      useDocumentListStore.getState().setActiveList('list-1')

      const state = useDocumentListStore.getState()
      expect(state.listItems).toEqual(mockItems) // Items unchanged
    })

    // Story 4.14: Instant switching tests
    it('should return cached items instantly without fetch call', async () => {
      // Pre-populate cache
      const cache = new Map<string, ListCacheEntry>()
      cache.set('list-2', { items: mockItems, fetchedAt: Date.now() })

      useDocumentListStore.setState({
        lists: mockLists,
        activeListId: 'list-1',
        listItems: [],
        itemsByList: cache,
      })

      // Mock should NOT be called for cached list
      vi.mocked(actions.getDocumentListItems).mockClear()

      // Act - switch to cached list
      useDocumentListStore.getState().setActiveList('list-2')

      // Assert - items should be immediately available from cache
      const state = useDocumentListStore.getState()
      expect(state.activeListId).toBe('list-2')
      expect(state.listItems).toEqual(mockItems)
      // No loading state for cached switch
      expect(state.isLoadingItems).toBe(false)
    })

    it('should trigger fetch with loading state for uncached list', async () => {
      vi.mocked(actions.getDocumentListItems).mockResolvedValue({
        success: true,
        data: { items: mockItems, total: mockItems.length, hasMore: false },
      })

      useDocumentListStore.setState({
        lists: mockLists,
        activeListId: 'list-1',
        listItems: mockItems,
        itemsByList: new Map(), // Empty cache
      })

      // Act - switch to uncached list
      useDocumentListStore.getState().setActiveList('list-2')

      // Assert - loading state should be set immediately
      const stateAfterSwitch = useDocumentListStore.getState()
      expect(stateAfterSwitch.activeListId).toBe('list-2')
      expect(stateAfterSwitch.isLoadingItems).toBe(true)
      expect(stateAfterSwitch.listItems).toEqual([]) // Cleared for uncached

      // Wait for fetch to complete
      await act(async () => {
        await new Promise((resolve) => setTimeout(resolve, 10))
      })

      // Fetch should have been called
      expect(actions.getDocumentListItems).toHaveBeenCalledWith(
        expect.objectContaining({ listId: 'list-2' })
      )
    })
  })

  describe('setContentTypeFilter', () => {
    it('should set content type filter', async () => {
      vi.mocked(actions.getDocumentListItems).mockResolvedValue({
        success: true,
        data: { items: [], total: 0, hasMore: false },
      })

      useDocumentListStore.setState({ activeListId: 'list-1' })

      await act(async () => {
        useDocumentListStore.getState().setContentTypeFilter(['SFS_LAW'])
      })

      const state = useDocumentListStore.getState()
      expect(state.contentTypeFilter).toEqual(['SFS_LAW'])
      expect(state.page).toBe(1) // Reset to page 1
    })

    it('should clear filter when null', async () => {
      vi.mocked(actions.getDocumentListItems).mockResolvedValue({
        success: true,
        data: { items: [], total: 0, hasMore: false },
      })

      useDocumentListStore.setState({
        activeListId: 'list-1',
        contentTypeFilter: ['SFS_LAW'],
      })

      await act(async () => {
        useDocumentListStore.getState().setContentTypeFilter(null)
      })

      const state = useDocumentListStore.getState()
      expect(state.contentTypeFilter).toBeNull()
    })
  })

  describe('setContentTypeGroupFilter', () => {
    it('should set filter for group', async () => {
      vi.mocked(actions.getDocumentListItems).mockResolvedValue({
        success: true,
        data: { items: [], total: 0, hasMore: false },
      })

      useDocumentListStore.setState({ activeListId: 'list-1' })

      await act(async () => {
        useDocumentListStore.getState().setContentTypeGroupFilter('laws')
      })

      const state = useDocumentListStore.getState()
      expect(state.contentTypeFilter).toEqual(['SFS_LAW'])
    })

    it('should clear filter for "all" group', async () => {
      vi.mocked(actions.getDocumentListItems).mockResolvedValue({
        success: true,
        data: { items: [], total: 0, hasMore: false },
      })

      useDocumentListStore.setState({
        activeListId: 'list-1',
        contentTypeFilter: ['SFS_LAW'],
      })

      await act(async () => {
        useDocumentListStore.getState().setContentTypeGroupFilter('all')
      })

      const state = useDocumentListStore.getState()
      expect(state.contentTypeFilter).toBeNull()
    })

    it('should clear filter for null group', async () => {
      vi.mocked(actions.getDocumentListItems).mockResolvedValue({
        success: true,
        data: { items: [], total: 0, hasMore: false },
      })

      useDocumentListStore.setState({
        activeListId: 'list-1',
        contentTypeFilter: ['SFS_LAW'],
      })

      await act(async () => {
        useDocumentListStore.getState().setContentTypeGroupFilter(null)
      })

      const state = useDocumentListStore.getState()
      expect(state.contentTypeFilter).toBeNull()
    })
  })

  describe('removeItem (optimistic update)', () => {
    it('should remove item optimistically', async () => {
      vi.mocked(actions.removeDocumentFromList).mockResolvedValue({
        success: true,
      })

      useDocumentListStore.setState({
        activeListId: 'list-1',
        listItems: mockItems,
        lists: mockLists,
        total: 3,
      })

      let result: boolean
      await act(async () => {
        result = await useDocumentListStore.getState().removeItem('item-1')
      })

      expect(result!).toBe(true)
      const state = useDocumentListStore.getState()
      expect(state.listItems).toHaveLength(2) // 3 - 1 = 2
      expect(state.listItems.find((i) => i.id === 'item-1')).toBeUndefined()
      expect(state.total).toBe(2)
    })

    it('should rollback on error', async () => {
      vi.mocked(actions.removeDocumentFromList).mockResolvedValue({
        success: false,
        error: 'Failed to remove',
      })

      useDocumentListStore.setState({
        activeListId: 'list-1',
        listItems: mockItems,
        lists: mockLists,
      })

      let result: boolean
      await act(async () => {
        result = await useDocumentListStore.getState().removeItem('item-1')
      })

      expect(result!).toBe(false)
      const state = useDocumentListStore.getState()
      expect(state.listItems).toHaveLength(3) // Rolled back to original 3 items
      expect(state.error).toBe('Failed to remove')
    })
  })

  describe('reorderItems (optimistic update)', () => {
    it('should reorder items optimistically', async () => {
      vi.mocked(actions.reorderListItems).mockResolvedValue({ success: true })

      useDocumentListStore.setState({
        activeListId: 'list-1',
        listItems: mockItems,
      })

      const newOrder = [
        { id: 'item-2', position: 0 },
        { id: 'item-1', position: 1 },
      ]

      let result: boolean
      await act(async () => {
        result = await useDocumentListStore.getState().reorderItems(newOrder)
      })

      expect(result!).toBe(true)
      expect(actions.reorderListItems).toHaveBeenCalledWith({
        listId: 'list-1',
        items: newOrder,
      })
    })

    it('should rollback on error', async () => {
      vi.mocked(actions.reorderListItems).mockResolvedValue({
        success: false,
        error: 'Failed to reorder',
      })

      useDocumentListStore.setState({
        activeListId: 'list-1',
        listItems: mockItems,
      })

      let result: boolean
      await act(async () => {
        result = await useDocumentListStore.getState().reorderItems([
          { id: 'item-2', position: 0 },
          { id: 'item-1', position: 1 },
        ])
      })

      expect(result!).toBe(false)
      const state = useDocumentListStore.getState()
      expect(state.error).toBe('Failed to reorder')
    })

    it('should return false if no active list', async () => {
      useDocumentListStore.setState({
        activeListId: null,
      })

      let result: boolean
      await act(async () => {
        result = await useDocumentListStore.getState().reorderItems([])
      })

      expect(result!).toBe(false)
    })
  })

  describe('clearError', () => {
    it('should clear error', () => {
      useDocumentListStore.setState({ error: 'Some error' })

      useDocumentListStore.getState().clearError()

      expect(useDocumentListStore.getState().error).toBeNull()
    })
  })

  describe('reset', () => {
    it('should reset to initial state', () => {
      useDocumentListStore.setState({
        lists: mockLists,
        activeListId: 'list-1',
        listItems: mockItems,
        error: 'Some error',
      })

      useDocumentListStore.getState().reset()

      const state = useDocumentListStore.getState()
      expect(state.lists).toEqual([])
      expect(state.activeListId).toBeNull()
      expect(state.listItems).toEqual([])
      expect(state.error).toBeNull()
    })
  })

  describe('Selectors', () => {
    describe('selectActiveList', () => {
      it('should return active list', () => {
        useDocumentListStore.setState({
          lists: mockLists,
          activeListId: 'list-1',
        })

        const activeList = selectActiveList(useDocumentListStore.getState())
        expect(activeList?.id).toBe('list-1')
        expect(activeList?.name).toBe('Huvudlista')
      })

      it('should return undefined if no active list', () => {
        useDocumentListStore.setState({
          lists: mockLists,
          activeListId: null,
        })

        const activeList = selectActiveList(useDocumentListStore.getState())
        expect(activeList).toBeUndefined()
      })
    })

    describe('selectIsLoading', () => {
      it('should return true when loading lists', () => {
        useDocumentListStore.setState({ isLoadingLists: true })
        expect(selectIsLoading(useDocumentListStore.getState())).toBe(true)
      })

      it('should return true when loading items', () => {
        useDocumentListStore.setState({ isLoadingItems: true })
        expect(selectIsLoading(useDocumentListStore.getState())).toBe(true)
      })

      it('should return false when not loading', () => {
        useDocumentListStore.setState({
          isLoadingLists: false,
          isLoadingItems: false,
        })
        expect(selectIsLoading(useDocumentListStore.getState())).toBe(false)
      })
    })
  })

  // ===========================================================================
  // Story 4.13: Document Grouping Tests
  // ===========================================================================

  describe('Story 4.13: Group State', () => {
    describe('toggleGroupExpanded', () => {
      it('should toggle group from expanded to collapsed', () => {
        useDocumentListStore.setState({
          expandedGroups: { 'group-1': true },
        })

        useDocumentListStore.getState().toggleGroupExpanded('group-1')

        const state = useDocumentListStore.getState()
        expect(state.expandedGroups['group-1']).toBe(false)
      })

      it('should toggle group from collapsed to expanded', () => {
        useDocumentListStore.setState({
          expandedGroups: { 'group-1': false },
        })

        useDocumentListStore.getState().toggleGroupExpanded('group-1')

        const state = useDocumentListStore.getState()
        expect(state.expandedGroups['group-1']).toBe(true)
      })

      it('should default to collapsed when toggling undefined group', () => {
        useDocumentListStore.setState({
          expandedGroups: {},
        })

        useDocumentListStore.getState().toggleGroupExpanded('group-1')

        const state = useDocumentListStore.getState()
        // Default is true (expanded), so toggling makes it false
        expect(state.expandedGroups['group-1']).toBe(false)
      })
    })

    describe('expandAllGroups', () => {
      it('should expand all groups including ungrouped', () => {
        useDocumentListStore.setState({
          groups: mockGroups,
          expandedGroups: { 'group-1': false, 'group-2': false },
        })

        useDocumentListStore.getState().expandAllGroups()

        const state = useDocumentListStore.getState()
        expect(state.expandedGroups['group-1']).toBe(true)
        expect(state.expandedGroups['group-2']).toBe(true)
        expect(state.expandedGroups['__ungrouped__']).toBe(true)
      })
    })

    describe('collapseAllGroups', () => {
      it('should collapse all groups including ungrouped', () => {
        useDocumentListStore.setState({
          groups: mockGroups,
          expandedGroups: {
            'group-1': true,
            'group-2': true,
            __ungrouped__: true,
          },
        })

        useDocumentListStore.getState().collapseAllGroups()

        const state = useDocumentListStore.getState()
        expect(state.expandedGroups['group-1']).toBe(false)
        expect(state.expandedGroups['group-2']).toBe(false)
        expect(state.expandedGroups['__ungrouped__']).toBe(false)
      })
    })

    describe('setGroupExpanded', () => {
      it('should set specific group expansion state', () => {
        useDocumentListStore.setState({
          expandedGroups: {},
        })

        useDocumentListStore.getState().setGroupExpanded('group-1', false)

        const state = useDocumentListStore.getState()
        expect(state.expandedGroups['group-1']).toBe(false)
      })
    })
  })

  describe('Story 4.13: Group Filter Mode (Task 11)', () => {
    describe('setActiveGroupFilter', () => {
      it('should set active group filter', () => {
        useDocumentListStore.getState().setActiveGroupFilter('group-1')

        const state = useDocumentListStore.getState()
        expect(state.activeGroupFilter).toBe('group-1')
      })

      it('should set special ungrouped filter', () => {
        useDocumentListStore.getState().setActiveGroupFilter('__ungrouped__')

        const state = useDocumentListStore.getState()
        expect(state.activeGroupFilter).toBe('__ungrouped__')
      })
    })

    describe('clearGroupFilter', () => {
      it('should clear active group filter', () => {
        useDocumentListStore.setState({
          activeGroupFilter: 'group-1',
        })

        useDocumentListStore.getState().clearGroupFilter()

        const state = useDocumentListStore.getState()
        expect(state.activeGroupFilter).toBeNull()
      })
    })
  })

  describe('Story 4.13: moveToGroup (optimistic update)', () => {
    it('should move item to group optimistically', async () => {
      vi.mocked(actions.moveItemToGroup).mockResolvedValue({ success: true })
      vi.mocked(actions.getListGroups).mockResolvedValue({
        success: true,
        data: mockGroups,
      })

      useDocumentListStore.setState({
        activeListId: 'list-1',
        listItems: mockItems,
        groups: mockGroups,
      })

      let result: boolean
      await act(async () => {
        result = await useDocumentListStore
          .getState()
          .moveToGroup('item-2', 'group-1')
      })

      expect(result!).toBe(true)
      const state = useDocumentListStore.getState()
      const movedItem = state.listItems.find((i) => i.id === 'item-2')
      expect(movedItem?.groupId).toBe('group-1')
    })

    it('should move item to ungrouped optimistically', async () => {
      vi.mocked(actions.moveItemToGroup).mockResolvedValue({ success: true })
      vi.mocked(actions.getListGroups).mockResolvedValue({
        success: true,
        data: mockGroups,
      })

      useDocumentListStore.setState({
        activeListId: 'list-1',
        listItems: mockItems,
        groups: mockGroups,
      })

      let result: boolean
      await act(async () => {
        result = await useDocumentListStore
          .getState()
          .moveToGroup('item-1', null)
      })

      expect(result!).toBe(true)
      const state = useDocumentListStore.getState()
      const movedItem = state.listItems.find((i) => i.id === 'item-1')
      expect(movedItem?.groupId).toBeNull()
    })

    it('should rollback on error', async () => {
      vi.mocked(actions.moveItemToGroup).mockResolvedValue({
        success: false,
        error: 'Failed to move',
      })

      useDocumentListStore.setState({
        activeListId: 'list-1',
        listItems: mockItems,
        groups: mockGroups,
      })

      const originalGroupId = mockItems[0]?.groupId

      let result: boolean
      await act(async () => {
        result = await useDocumentListStore
          .getState()
          .moveToGroup('item-1', 'group-2')
      })

      expect(result!).toBe(false)
      const state = useDocumentListStore.getState()
      const item = state.listItems.find((i) => i.id === 'item-1')
      expect(item?.groupId).toBe(originalGroupId) // Rolled back
      expect(state.error).toBe('Failed to move')
    })

    it('should return false if no active list', async () => {
      useDocumentListStore.setState({
        activeListId: null,
      })

      let result: boolean
      await act(async () => {
        result = await useDocumentListStore
          .getState()
          .moveToGroup('item-1', 'group-1')
      })

      expect(result!).toBe(false)
    })
  })

  describe('Story 4.13: Group Selectors', () => {
    describe('selectGroupedItems', () => {
      it('should group items by groupId', () => {
        useDocumentListStore.setState({
          listItems: mockItems,
          groups: mockGroups,
        })

        const { grouped, ungrouped } = selectGroupedItems(
          useDocumentListStore.getState()
        )

        // group-1 has item-1 and item-3
        expect(grouped['group-1']).toHaveLength(2)
        expect(grouped['group-1']?.map((i) => i.id)).toContain('item-1')
        expect(grouped['group-1']?.map((i) => i.id)).toContain('item-3')

        // group-2 is empty
        expect(grouped['group-2']).toHaveLength(0)

        // item-2 is ungrouped
        expect(ungrouped).toHaveLength(1)
        expect(ungrouped[0]?.id).toBe('item-2')
      })

      it('should return empty grouped when no items', () => {
        useDocumentListStore.setState({
          listItems: [],
          groups: mockGroups,
        })

        const { grouped, ungrouped } = selectGroupedItems(
          useDocumentListStore.getState()
        )

        expect(grouped['group-1']).toHaveLength(0)
        expect(grouped['group-2']).toHaveLength(0)
        expect(ungrouped).toHaveLength(0)
      })
    })

    describe('selectItemsInGroup', () => {
      it('should return items in specific group', () => {
        useDocumentListStore.setState({
          listItems: mockItems,
        })

        const itemsInGroup1 = selectItemsInGroup('group-1')(
          useDocumentListStore.getState()
        )

        expect(itemsInGroup1).toHaveLength(2)
        expect(itemsInGroup1.map((i) => i.id)).toContain('item-1')
        expect(itemsInGroup1.map((i) => i.id)).toContain('item-3')
      })

      it('should return ungrouped items when groupId is null', () => {
        useDocumentListStore.setState({
          listItems: mockItems,
        })

        const ungroupedItems = selectItemsInGroup(null)(
          useDocumentListStore.getState()
        )

        expect(ungroupedItems).toHaveLength(1)
        expect(ungroupedItems[0]?.id).toBe('item-2')
      })
    })

    describe('selectUngroupedItemCount', () => {
      it('should count ungrouped items', () => {
        useDocumentListStore.setState({
          listItems: mockItems,
        })

        const count = selectUngroupedItemCount(useDocumentListStore.getState())

        expect(count).toBe(1)
      })
    })

    describe('selectIsGroupExpanded', () => {
      it('should return expansion state for group', () => {
        useDocumentListStore.setState({
          expandedGroups: { 'group-1': false, 'group-2': true },
        })

        expect(
          selectIsGroupExpanded('group-1')(useDocumentListStore.getState())
        ).toBe(false)
        expect(
          selectIsGroupExpanded('group-2')(useDocumentListStore.getState())
        ).toBe(true)
      })

      it('should default to expanded for undefined group', () => {
        useDocumentListStore.setState({
          expandedGroups: {},
        })

        expect(
          selectIsGroupExpanded('group-1')(useDocumentListStore.getState())
        ).toBe(true)
      })
    })

    describe('selectActiveGroupFilterInfo', () => {
      it('should return group info when filter is active', () => {
        useDocumentListStore.setState({
          activeGroupFilter: 'group-1',
          groups: mockGroups,
        })

        const info = selectActiveGroupFilterInfo(
          useDocumentListStore.getState()
        )

        expect(info?.id).toBe('group-1')
        expect(info?.name).toBe('GDPR Lagar')
      })

      it('should return ungrouped info for __ungrouped__ filter', () => {
        useDocumentListStore.setState({
          activeGroupFilter: '__ungrouped__',
          groups: mockGroups,
        })

        const info = selectActiveGroupFilterInfo(
          useDocumentListStore.getState()
        )

        expect(info?.id).toBe('__ungrouped__')
        expect(info?.name).toBe('Ogrupperade')
      })

      it('should return null when no filter active', () => {
        useDocumentListStore.setState({
          activeGroupFilter: null,
          groups: mockGroups,
        })

        const info = selectActiveGroupFilterInfo(
          useDocumentListStore.getState()
        )

        expect(info).toBeNull()
      })

      it('should return null for invalid group filter', () => {
        useDocumentListStore.setState({
          activeGroupFilter: 'invalid-group',
          groups: mockGroups,
        })

        const info = selectActiveGroupFilterInfo(
          useDocumentListStore.getState()
        )

        expect(info).toBeNull()
      })
    })

    describe('selectFilteredByGroupItems', () => {
      it('should return all items when no filter active', () => {
        useDocumentListStore.setState({
          listItems: mockItems,
          activeGroupFilter: null,
        })

        const items = selectFilteredByGroupItems(
          useDocumentListStore.getState()
        )

        expect(items).toHaveLength(3)
      })

      it('should return items in group when filter active', () => {
        useDocumentListStore.setState({
          listItems: mockItems,
          activeGroupFilter: 'group-1',
        })

        const items = selectFilteredByGroupItems(
          useDocumentListStore.getState()
        )

        expect(items).toHaveLength(2)
        expect(items.map((i) => i.id)).toContain('item-1')
        expect(items.map((i) => i.id)).toContain('item-3')
      })

      it('should return ungrouped items when __ungrouped__ filter active', () => {
        useDocumentListStore.setState({
          listItems: mockItems,
          activeGroupFilter: '__ungrouped__',
        })

        const items = selectFilteredByGroupItems(
          useDocumentListStore.getState()
        )

        expect(items).toHaveLength(1)
        expect(items[0]?.id).toBe('item-2')
      })
    })
  })

  // ===========================================================================
  // Story 4.14: Document List Performance Tests
  // ===========================================================================

  describe('Story 4.14: Per-List Item Cache', () => {
    describe('getCachedItems', () => {
      it('should return null for unknown list', () => {
        const result = useDocumentListStore
          .getState()
          .getCachedItems('unknown-list')
        expect(result).toBeNull()
      })

      it('should return items for cached list', () => {
        useDocumentListStore
          .getState()
          .setCachedItems('list-1', mockItems, mockItems.length)

        const result = useDocumentListStore.getState().getCachedItems('list-1')

        expect(result).toEqual(mockItems)
      })
    })

    describe('setCachedItems', () => {
      it('should store items correctly', () => {
        useDocumentListStore
          .getState()
          .setCachedItems('list-1', mockItems, mockItems.length)

        const state = useDocumentListStore.getState()
        const cached = state.itemsByList.get('list-1')

        expect(cached).toBeDefined()
        expect(cached?.items).toEqual(mockItems)
        expect(cached?.fetchedAt).toBeDefined()
        expect(cached?.fetchedAt).toBeLessThanOrEqual(Date.now())
      })

      it('should evict oldest entry when exceeding 10 lists', () => {
        // Add 10 lists with delays to ensure different timestamps
        for (let i = 0; i < 10; i++) {
          const cache = new Map(useDocumentListStore.getState().itemsByList)
          cache.set(`list-${i}`, {
            items: [],
            fetchedAt: Date.now() - (10 - i) * 1000,
          })
          useDocumentListStore.setState({ itemsByList: cache })
        }

        // Verify we have 10 lists
        expect(useDocumentListStore.getState().itemsByList.size).toBe(10)

        // Add 11th list
        useDocumentListStore.getState().setCachedItems('list-new', [], 0)

        const state = useDocumentListStore.getState()

        // Should still have 10 lists (oldest evicted)
        expect(state.itemsByList.size).toBe(10)
        // Oldest list (list-0) should be gone
        expect(state.itemsByList.has('list-0')).toBe(false)
        // New list should exist
        expect(state.itemsByList.has('list-new')).toBe(true)
      })
    })

    describe('invalidateListCache', () => {
      it('should remove specific list from cache', () => {
        useDocumentListStore
          .getState()
          .setCachedItems('list-1', mockItems, mockItems.length)
        useDocumentListStore.getState().setCachedItems('list-2', [], 0)

        useDocumentListStore.getState().invalidateListCache('list-1')

        const state = useDocumentListStore.getState()
        expect(state.itemsByList.has('list-1')).toBe(false)
        expect(state.itemsByList.has('list-2')).toBe(true)
      })
    })

    describe('updateActiveListCache', () => {
      it('should cache current listItems for active list', () => {
        useDocumentListStore.setState({
          activeListId: 'list-1',
          listItems: mockItems,
          total: mockItems.length,
        })

        useDocumentListStore.getState().updateActiveListCache()

        const cached = useDocumentListStore.getState().getCachedItems('list-1')
        expect(cached).toEqual(mockItems)
      })

      it('should not cache if no active list', () => {
        useDocumentListStore.setState({
          activeListId: null,
          listItems: mockItems,
        })

        useDocumentListStore.getState().updateActiveListCache()

        const state = useDocumentListStore.getState()
        expect(state.itemsByList.size).toBe(0)
      })
    })

    describe('addItem true optimistic update', () => {
      const mockDocumentInfo: DocumentInfo = {
        id: 'doc-new',
        title: 'New Document',
        documentNumber: 'SFS 2024:123',
        contentType: 'SFS_LAW',
        slug: 'sfs-2024-123',
        summary: 'A new law',
      }

      it('should create optimistic item before server response', async () => {
        // Mock slow server response
        let resolveServerCall: (_value: { success: boolean }) => void
        vi.mocked(actions.addDocumentToList).mockImplementation(
          () =>
            new Promise((resolve) => {
              resolveServerCall = resolve
            })
        )

        useDocumentListStore.setState({
          activeListId: 'list-1',
          listItems: [],
          lists: mockLists,
          itemsByList: new Map(),
        })

        // Start add operation
        const addPromise = useDocumentListStore
          .getState()
          .addItem('list-1', 'doc-new', mockDocumentInfo, 'My commentary')

        // Check state immediately - item should be added optimistically
        const stateAfterOptimistic = useDocumentListStore.getState()
        expect(stateAfterOptimistic.listItems).toHaveLength(1)
        expect(stateAfterOptimistic.listItems[0]?.document.id).toBe('doc-new')
        expect(stateAfterOptimistic.listItems[0]?.document.title).toBe(
          'New Document'
        )
        expect(stateAfterOptimistic.listItems[0]?.commentary).toBe(
          'My commentary'
        )
        expect(stateAfterOptimistic.listItems[0]?.id).toMatch(/^temp-/)
        // No loading state
        expect(stateAfterOptimistic.isAddingItem).toBe(false)

        // Resolve server call
        resolveServerCall!({ success: true })
        await addPromise

        // Item should still be there
        const finalState = useDocumentListStore.getState()
        expect(finalState.listItems).toHaveLength(1)
      })

      it('should rollback on server error', async () => {
        vi.mocked(actions.addDocumentToList).mockResolvedValue({
          success: false,
          error: 'Document already in list',
        })

        useDocumentListStore.setState({
          activeListId: 'list-1',
          listItems: mockItems, // Start with existing items
          lists: mockLists,
          itemsByList: new Map(),
        })

        const initialCount = mockItems.length

        let result: boolean
        await act(async () => {
          result = await useDocumentListStore
            .getState()
            .addItem('list-1', 'doc-new', mockDocumentInfo)
        })

        expect(result!).toBe(false)
        const state = useDocumentListStore.getState()
        // Optimistic item should be rolled back
        expect(state.listItems).toHaveLength(initialCount)
        // Error should be set
        expect(state.error).toBe('Document already in list')
      })

      it('should rollback on exception', async () => {
        vi.mocked(actions.addDocumentToList).mockRejectedValue(
          new Error('Network error')
        )

        useDocumentListStore.setState({
          activeListId: 'list-1',
          listItems: [],
          lists: mockLists,
          itemsByList: new Map(),
        })

        let result: boolean
        await act(async () => {
          result = await useDocumentListStore
            .getState()
            .addItem('list-1', 'doc-new', mockDocumentInfo)
        })

        expect(result!).toBe(false)
        const state = useDocumentListStore.getState()
        expect(state.listItems).toHaveLength(0) // Rolled back
        expect(state.error).toBe('Något gick fel')
      })
    })

    describe('fetchItems stale response handling', () => {
      it('should discard stale response when user switched lists during fetch', async () => {
        const list1Items: DocumentListItem[] = [mockItems[0]!]
        const list2Items: DocumentListItem[] = [mockItems[1]!]

        // Mock slow response for list-1
        vi.mocked(actions.getDocumentListItems).mockImplementation(
          async ({ listId }) => {
            if (listId === 'list-1') {
              // Slow response
              await new Promise((resolve) => setTimeout(resolve, 50))
              return {
                success: true,
                data: { items: list1Items, total: 1, hasMore: false },
              }
            }
            // Fast response for list-2
            return {
              success: true,
              data: { items: list2Items, total: 1, hasMore: false },
            }
          }
        )

        useDocumentListStore.setState({
          lists: mockLists,
          activeListId: 'list-1',
          listItems: [],
          itemsByList: new Map(),
        })

        // Start fetching list-1
        const fetchPromise = useDocumentListStore
          .getState()
          .fetchItems(true, false)

        // Immediately switch to list-2 (before list-1 fetch completes)
        await act(async () => {
          await new Promise((resolve) => setTimeout(resolve, 10))
          useDocumentListStore.getState().setActiveList('list-2')
        })

        // Wait for list-1 fetch to complete
        await fetchPromise

        // Wait a bit more for list-2 fetch to complete
        await act(async () => {
          await new Promise((resolve) => setTimeout(resolve, 100))
        })

        // Assert - should show list-2 items, not list-1
        const state = useDocumentListStore.getState()
        expect(state.activeListId).toBe('list-2')
        expect(state.listItems).toEqual(list2Items)
      })
    })
  })
})
