'use client'

/**
 * Story 4.11, 4.12 & 4.13: Document List Page Content
 * Main client component that orchestrates the document list UI
 *
 * Story 4.13 Task 0: Added URL deep linking support via ?list={listId} query param
 */

import { useEffect, useState, useCallback } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import {
  useDocumentListStore,
  selectActiveList,
  selectActiveGroupFilterInfo,
  selectFilteredByGroupItems,
} from '@/lib/stores/document-list-store'
import { DocumentListSwitcher } from './document-list-switcher'
import { DocumentListTable } from './document-list-table'
import { GroupedDocumentList } from './grouped-document-list'
import { GroupManager } from './group-manager'
import { GroupFilterChip } from './group-filter-chip'
import { ContentTypeFilter } from './content-type-filter'
import { AddDocumentModal, type DocumentInfoForAdd } from './add-document-modal'
import { ManageListModal } from './manage-list-modal'
import { ExportDropdown } from './export-dropdown'
import { ViewToggle } from './view-toggle'
import { Button } from '@/components/ui/button'
import { Plus, Settings, FolderPlus } from 'lucide-react'
import type {
  DocumentListSummary,
  WorkspaceMemberOption,
} from '@/app/actions/document-list'
import { getWorkspaceMembers } from '@/app/actions/document-list'
import type { LawListItemStatus, LawListItemPriority } from '@prisma/client'

interface DocumentListPageContentProps {
  initialLists: DocumentListSummary[]
  defaultListId: string | null
}

export function DocumentListPageContent({
  initialLists,
  defaultListId,
}: DocumentListPageContentProps) {
  const [isAddModalOpen, setIsAddModalOpen] = useState(false)
  const [isManageModalOpen, setIsManageModalOpen] = useState(false)
  const [manageModalMode, setManageModalMode] = useState<'create' | 'edit'>(
    'create'
  )
  const [workspaceMembers, setWorkspaceMembers] = useState<
    WorkspaceMemberOption[]
  >([])
  // Story 4.13: Group management modal
  const [isGroupManagerOpen, setIsGroupManagerOpen] = useState(false)

  // Story 4.13 Task 0: URL deep linking
  const searchParams = useSearchParams()
  const router = useRouter()

  const {
    lists,
    activeListId,
    listItems,
    contentTypeFilter,
    total,
    hasMore,
    isLoadingLists,
    isLoadingItems,
    fetchLists,
    setActiveList,
    fetchItems,
    loadMoreItems,
    setContentTypeGroupFilter,
    addItem,
    removeItem,
    reorderItems,
    // Story 4.14: Use store's optimistic update methods
    updateItem,
    bulkUpdateItems,
    error,
    clearError,
    // Story 4.12: Table view state
    viewMode,
    setViewMode,
    columnVisibility,
    setColumnVisibility,
    // Story 4.13: Group state
    groups,
    expandedGroups,
    activeGroupFilter,
    fetchGroups,
    toggleGroupExpanded,
    expandAllGroups,
    collapseAllGroups,
    moveToGroup,
    setActiveGroupFilter,
    clearGroupFilter,
  } = useDocumentListStore()

  const activeList = useDocumentListStore(selectActiveList)
  const activeGroupFilterInfo = useDocumentListStore(
    selectActiveGroupFilterInfo
  )
  const filteredItems = useDocumentListStore(selectFilteredByGroupItems)

  // Story 4.13 Task 0: Handle list change with URL update
  // Story 4.14: Just update URL - let useEffect handle setActiveList (same as sidebar)
  const handleListChange = useCallback(
    (listId: string) => {
      // Only update URL - useEffect will handle setActiveList for consistency
      router.push(`/laglistor?list=${listId}`, { scroll: false })
    },
    [router]
  )

  // Story 4.13 Task 11: Handle group filter with URL update
  const handleFilterByGroup = useCallback(
    (groupId: string) => {
      setActiveGroupFilter(groupId)
      // Update URL with group param (preserve list param)
      const params = new URLSearchParams(searchParams.toString())
      params.set('group', groupId)
      router.push(`/laglistor?${params.toString()}`, { scroll: false })
    },
    [setActiveGroupFilter, searchParams, router]
  )

  // Story 4.13 Task 11: Handle clear group filter
  const handleClearGroupFilter = useCallback(() => {
    clearGroupFilter()
    // Remove group param from URL (preserve list param)
    const params = new URLSearchParams(searchParams.toString())
    params.delete('group')
    router.push(`/laglistor?${params.toString()}`, { scroll: false })
  }, [clearGroupFilter, searchParams, router])

  // Initialize store with server data (only on mount)
  useEffect(() => {
    if (initialLists.length > 0) {
      // Hydrate store with initial data
      const listIdFromUrl = searchParams.get('list')
      let targetListId: string | null = null

      if (listIdFromUrl && initialLists.some((l) => l.id === listIdFromUrl)) {
        targetListId = listIdFromUrl
      } else if (defaultListId) {
        targetListId = defaultListId
      } else if (initialLists[0]?.id) {
        targetListId = initialLists[0].id
      }

      useDocumentListStore.setState({
        lists: initialLists,
        activeListId: targetListId,
      })

      if (targetListId) {
        fetchItems(true)
        fetchGroups() // Ensure groups are loaded on init
      }

      // Sync URL if it doesn't match active list
      if (targetListId && listIdFromUrl !== targetListId) {
        router.replace(`/laglistor?list=${targetListId}`, { scroll: false })
      }
    } else {
      fetchLists()
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // Story 4.13 Task 0: Watch for URL param changes (e.g., from sidebar navigation)
  // Story 4.14: setActiveList handles caching + fetch internally
  const listIdFromUrl = searchParams.get('list')
  useEffect(() => {
    // If URL has a list param and it's different from current active list, switch to it
    if (
      listIdFromUrl &&
      listIdFromUrl !== activeListId &&
      lists.some((l) => l.id === listIdFromUrl)
    ) {
      setActiveList(listIdFromUrl) // Handles cache check + fetch internally
      clearGroupFilter() // Clear group filter when switching lists
    }
  }, [listIdFromUrl, activeListId, lists, setActiveList, clearGroupFilter])

  // Story 4.13 Task 11: Watch for group URL param changes
  const groupIdFromUrl = searchParams.get('group')
  useEffect(() => {
    // Sync store with URL group param
    if (groupIdFromUrl && groupIdFromUrl !== activeGroupFilter) {
      setActiveGroupFilter(groupIdFromUrl)
    } else if (!groupIdFromUrl && activeGroupFilter) {
      clearGroupFilter()
    }
  }, [
    groupIdFromUrl,
    activeGroupFilter,
    setActiveGroupFilter,
    clearGroupFilter,
  ])

  // Clear error on unmount
  useEffect(() => {
    return () => clearError()
  }, [clearError])

  // Fetch workspace members for assignee dropdown (Story 4.12)
  useEffect(() => {
    async function fetchMembers() {
      const result = await getWorkspaceMembers()
      if (result.success && result.data) {
        setWorkspaceMembers(result.data)
      }
    }
    fetchMembers()
  }, [])

  // Story 4.13: Fetch groups when activeListId changes
  useEffect(() => {
    if (activeListId) {
      fetchGroups()
    }
  }, [activeListId, fetchGroups])

  // Story 4.13: Refresh groups when group manager closes
  const handleGroupsUpdated = useCallback(() => {
    fetchGroups()
    // Also refresh items to get updated group assignments
    fetchItems(true)
  }, [fetchGroups, fetchItems])

  const handleCreateList = () => {
    setManageModalMode('create')
    setIsManageModalOpen(true)
  }

  const handleEditList = () => {
    setManageModalMode('edit')
    setIsManageModalOpen(true)
  }

  const handleListCreated = (listId: string) => {
    setIsManageModalOpen(false)
    fetchLists().then(() => {
      handleListChange(listId)
    })
  }

  const handleListUpdated = () => {
    setIsManageModalOpen(false)
    fetchLists()
  }

  const handleListDeleted = () => {
    setIsManageModalOpen(false)
    fetchLists()
  }

  // Story 4.14: Accept document info for true optimistic update
  const handleAddDocument = async (
    documentId: string,
    documentInfo: DocumentInfoForAdd
  ) => {
    if (!activeListId) return false
    return addItem(activeListId, documentId, documentInfo)
  }

  // Story 4.12 & 4.14: Handle inline item updates using store's optimistic method
  const handleUpdateItem = async (
    itemId: string,
    updates: {
      status?: LawListItemStatus
      priority?: LawListItemPriority
      dueDate?: Date | null
      assignedTo?: string | null
      groupId?: string | null
    }
  ) => {
    // Story 4.14: Use store's optimistic update (no refetch needed)
    const success = await updateItem(itemId, updates)
    // Refresh groups to update item counts when group changes
    if (success && updates.groupId !== undefined) {
      fetchGroups()
    }
    return success
  }

  // Story 4.12 & 4.14: Handle bulk updates using store's optimistic method
  const handleTableBulkUpdate = async (
    itemIds: string[],
    updates: {
      status?: LawListItemStatus
      priority?: LawListItemPriority
    }
  ): Promise<boolean> => {
    // Story 4.14: Use store's optimistic bulk update (no refetch needed)
    return bulkUpdateItems(itemIds, updates)
  }

  return (
    <div className="flex flex-col gap-6">
      {/* Header row with list switcher and actions */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <DocumentListSwitcher
          lists={lists}
          activeListId={activeListId}
          onSelectList={handleListChange}
          onCreateList={handleCreateList}
          isLoading={isLoadingLists}
        />

        <div className="flex items-center gap-2">
          {/* Story 4.12: View toggle */}
          <ViewToggle value={viewMode} onChange={setViewMode} />

          <Button
            onClick={() => setIsAddModalOpen(true)}
            disabled={!activeListId}
          >
            <Plus className="mr-2 h-4 w-4" />
            Lägg till dokument
          </Button>

          <ExportDropdown
            listId={activeListId}
            listName={activeList?.name ?? 'lista'}
            disabled={!activeListId || listItems.length === 0}
          />

          {/* Story 4.13: Manage groups button (shown in both views) */}
          <Button
            variant="outline"
            onClick={() => setIsGroupManagerOpen(true)}
            disabled={!activeListId}
            title="Hantera grupper"
          >
            <FolderPlus className="mr-2 h-4 w-4" />
            <span className="hidden sm:inline">Grupper</span>
          </Button>

          <Button
            variant="outline"
            size="icon"
            onClick={handleEditList}
            disabled={!activeListId}
            title="Hantera lista"
          >
            <Settings className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Content type filter chips */}
      <div className="flex flex-wrap items-center gap-3">
        <ContentTypeFilter
          activeFilter={contentTypeFilter}
          onFilterChange={setContentTypeGroupFilter}
        />

        {/* Story 4.13 Task 11: Group filter chip */}
        {activeGroupFilterInfo && (
          <GroupFilterChip
            groupName={activeGroupFilterInfo.name}
            onClear={handleClearGroupFilter}
          />
        )}
      </div>

      {/* Error message */}
      {error && (
        <div className="rounded-lg border border-destructive/50 bg-destructive/10 p-4 text-sm text-destructive">
          {error}
          <button
            onClick={clearError}
            className="ml-2 underline hover:no-underline"
          >
            Stäng
          </button>
        </div>
      )}

      {/* Document grid or table based on view mode */}
      {/* Story 4.13 Task 11: When group filter is active, show filtered items in flat view */}
      {viewMode === 'card' ? (
        <GroupedDocumentList
          items={activeGroupFilter ? filteredItems : listItems}
          groups={activeGroupFilter ? [] : groups} // Hide groups when filtering
          expandedGroups={expandedGroups}
          total={activeGroupFilter ? filteredItems.length : total}
          hasMore={activeGroupFilter ? false : hasMore} // Disable pagination when filtering
          isLoading={isLoadingItems}
          onLoadMore={loadMoreItems}
          onRemoveItem={removeItem}
          onReorderItems={reorderItems}
          onMoveToGroup={moveToGroup}
          onToggleGroup={toggleGroupExpanded}
          onExpandAll={expandAllGroups}
          onCollapseAll={collapseAllGroups}
          onManageGroups={() => setIsGroupManagerOpen(true)}
          onFilterByGroup={handleFilterByGroup}
          emptyMessage={
            activeListId
              ? 'Inga dokument i denna lista. Lägg till dokument för att komma igång.'
              : 'Välj eller skapa en lista för att komma igång.'
          }
        />
      ) : (
        <DocumentListTable
          items={activeGroupFilter ? filteredItems : listItems}
          total={activeGroupFilter ? filteredItems.length : total}
          hasMore={activeGroupFilter ? false : hasMore}
          isLoading={isLoadingItems}
          columnVisibility={columnVisibility}
          onColumnVisibilityChange={setColumnVisibility}
          onLoadMore={loadMoreItems}
          onUpdateItem={handleUpdateItem}
          onBulkUpdate={handleTableBulkUpdate}
          onRemoveItem={removeItem}
          onReorderItems={reorderItems}
          workspaceMembers={workspaceMembers}
          groups={groups}
          onMoveToGroup={moveToGroup}
          emptyMessage={
            activeListId
              ? 'Inga dokument i denna lista. Lägg till dokument för att komma igång.'
              : 'Välj eller skapa en lista för att komma igång.'
          }
        />
      )}

      {/* Add document modal */}
      <AddDocumentModal
        open={isAddModalOpen}
        onOpenChange={setIsAddModalOpen}
        listId={activeListId}
        onAddDocument={handleAddDocument}
      />

      {/* Manage list modal */}
      <ManageListModal
        open={isManageModalOpen}
        onOpenChange={setIsManageModalOpen}
        mode={manageModalMode}
        list={manageModalMode === 'edit' ? activeList : undefined}
        onCreated={handleListCreated}
        onUpdated={handleListUpdated}
        onDeleted={handleListDeleted}
      />

      {/* Story 4.13: Group manager modal */}
      {activeListId && (
        <GroupManager
          open={isGroupManagerOpen}
          onOpenChange={setIsGroupManagerOpen}
          listId={activeListId}
          onGroupsUpdated={handleGroupsUpdated}
        />
      )}
    </div>
  )
}
