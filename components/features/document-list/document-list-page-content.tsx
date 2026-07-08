'use client'

/**
 * Story 4.11, 4.12, 4.13 & 6.2: Document List Page Content
 * Main client component that orchestrates the document list UI
 *
 * Story 4.13 Task 0: Added URL deep linking support via ?list={listId} query param
 * Story 6.2 Task 8 & 9: Added compliance filters and search functionality
 */

import { useEffect, useState, useCallback, useMemo, useTransition } from 'react'
import { useSWRConfig } from 'swr'
import { usePrefetchDocuments } from '@/lib/hooks/use-prefetch-documents'
import { useSearchParams, useRouter } from 'next/navigation'
import { useShallow } from 'zustand/react/shallow'
import {
  useDocumentListStore,
  selectActiveList,
  selectActiveGroupFilterInfo,
  selectFilteredByGroupItems,
} from '@/lib/stores/document-list-store'
import { DocumentListSwitcher } from './document-list-switcher'
import { DocumentListTable } from './document-list-table'
// Story 6.14: Grouped accordion tables for table view
import { GroupedDocumentListTable } from './grouped-document-list-table'
// Story 6.18: Compliance detail table (Efterlevnad view)
import { ComplianceDetailTable } from './compliance-detail-table'
// Story 6.18: Grouped compliance table (same accordion structure as table view)
import { GroupedComplianceTable } from './grouped-compliance-table'
import { ManageLawGroupsPopover } from './manage-law-groups-popover'
import { ManageListModal } from './manage-list-modal'
import { EmptyLawListState } from './empty-law-list-state'
// Story 6.3: Legal Document Modal
import { LegalDocumentModal } from './legal-document-modal'
// Story 6.15: Task Modal for bidirectional linking
import { TaskModal } from '@/components/features/tasks/task-modal'
import type { InitialListItemData } from '@/lib/hooks/use-list-item-details'
// Story 6.2: Compliance filters and search
import {
  parseFiltersFromUrl,
  hasActiveFilters as checkHasActiveFilters,
  type ComplianceFiltersState,
} from './compliance-filters'
import { FilterEmptyState } from './filter-empty-state'
import { SearchInput } from './search-input'
import { Button } from '@/components/ui/button'
import { EmptyState } from '@/components/ui/empty-state'
import { LawListPrimaryAction } from './law-list-primary-action'
import { ToolbarItemCount } from '@/components/ui/unified-toolbar'
import { FileText, Settings, Upload } from 'lucide-react'
// Toolbar redesign
import { LawListToolbar } from './law-list-toolbar'
import { ViewMenu } from './view-menu'
import { FilterBar } from './filter-bar'
import { LawListTabsStrip } from '@/components/features/changes/law-list-tabs-strip'
import type {
  DocumentListSummary,
  WorkspaceMemberOption,
} from '@/app/actions/document-list'
import { getWorkspaceMembers } from '@/app/actions/document-list'
import { getTaskColumns, type TaskColumnWithCount } from '@/app/actions/tasks'
import type { TaskProgress } from '@/app/actions/legal-document-modal'
import type {
  LawListItemStatus,
  LawListItemPriority,
  ComplianceStatus,
} from '@prisma/client'
import type { PublishedTemplate } from '@/lib/db/queries/template-catalog'

interface DocumentListPageContentProps {
  initialLists: DocumentListSummary[]
  defaultListId: string | null
  publishedTemplates?: PublishedTemplate[] | undefined
  /** Story 17.16: Server-derived permission flag — disables kravpunkter + kommentar edits for users lacking `tasks:edit` */
  complianceReadOnly?: boolean
  /**
   * Pending-imports follow-up: when the workspace has any in-flight
   * import (AWAITING_REVIEW / MATCHING), the banner above already
   * surfaces the next step — suppress the Story 24.6 zero-lists empty
   * state so we don't double up with conflicting "what to do next" copy.
   */
  hasPendingImports?: boolean
  /** Unacknowledged change count for the Ändringar tab badge (rendered inline in the toolbar). */
  initialChangeCount?: number
}

export function DocumentListPageContent({
  initialLists,
  defaultListId,
  publishedTemplates,
  complianceReadOnly,
  hasPendingImports = false,
  initialChangeCount = 0,
}: DocumentListPageContentProps) {
  const [isManageModalOpen, setIsManageModalOpen] = useState(false)
  const [manageModalMode, setManageModalMode] = useState<'create' | 'edit'>(
    'create'
  )
  // Story 24.6: when the empty-state "importera en lista" link is clicked,
  // open the modal directly on the import step (skip the chooser).
  const [manageModalInitialStep, setManageModalInitialStep] = useState<
    'choose' | 'from-template' | 'blank' | 'import' | undefined
  >(undefined)
  const [workspaceMembers, setWorkspaceMembers] = useState<
    WorkspaceMemberOption[]
  >([])
  // Story 6.15: Task columns for status dropdown in TaskModal
  const [taskColumns, setTaskColumns] = useState<TaskColumnWithCount[]>([])
  // Story 4.13: Group management popover (standalone toolbar trigger)
  const [isGroupManagerOpen, setIsGroupManagerOpen] = useState(false)
  // Story 6.3: Legal document modal - Now with URL state management
  // Modal state is derived from URL, not local state
  const [selectedListItemId, setSelectedListItemId] = useState<string | null>(
    null
  )
  // Story 6.15: Task modal for bidirectional linking
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null)
  // Story 6.18 + 17.18 + 21.22: Field to focus when opening modal from "Lägg till" click
  const [focusField, setFocusField] = useState<
    'businessContext' | 'complianceNarrative' | 'kravpunkter' | null
  >(null)

  // Toolbar redesign: filter bar visibility
  const [isFilterBarOpen, setIsFilterBarOpen] = useState(false)

  // Story 6.15: SWR config for invalidating task cache when task is updated
  const { mutate: globalMutate } = useSWRConfig()

  // Story 6.2 Task 8 & 9: Compliance filters and search state
  const [searchQuery, setSearchQuery] = useState('')
  const [complianceFilters, setComplianceFilters] =
    useState<ComplianceFiltersState>({
      complianceStatus: [],
      category: [],
      responsibleUserId: null,
    })

  // Story 4.13 Task 0: URL deep linking
  const searchParams = useSearchParams()
  const router = useRouter()

  // Use transition for non-urgent URL updates
  const [, startTransition] = useTransition()

  // Handle opening the modal by updating URL
  const handleOpenModal = useCallback((listItemId: string) => {
    // Update local state immediately for instant feedback
    setSelectedListItemId(listItemId)
    setFocusField(null) // Clear focus field for normal modal open
    // Update URL instantly using History API (faster than router.push)
    const params = new URLSearchParams(window.location.search)
    params.set('document', listItemId)
    window.history.pushState(null, '', `?${params.toString()}`)
  }, [])

  // Story 6.18 + 17.18: Handle opening modal with specific field focused (from "Lägg till" click)
  const handleAddContent = useCallback(
    (
      listItemId: string,
      field: 'businessContext' | 'complianceNarrative' | 'kravpunkter'
    ) => {
      setSelectedListItemId(listItemId)
      setFocusField(field) // Set focus field to trigger edit mode / scroll
      const params = new URLSearchParams(window.location.search)
      params.set('document', listItemId)
      window.history.pushState(null, '', `?${params.toString()}`)
    },
    []
  )

  // Handle closing the modal by removing from URL
  const handleCloseModal = useCallback(() => {
    // Update local state immediately for instant feedback
    setSelectedListItemId(null)
    // Update URL instantly using History API (faster than router.push)
    const params = new URLSearchParams(window.location.search)
    params.delete('document')
    const newUrl = params.toString()
      ? `?${params.toString()}`
      : window.location.pathname
    window.history.pushState(null, '', newUrl)
  }, [])

  // Story 6.15: Handle opening task modal from LegalDocumentModal
  const handleOpenTask = useCallback((taskId: string) => {
    setSelectedTaskId(taskId)
  }, [])

  // Story 6.15: Handle closing task modal
  const handleCloseTaskModal = useCallback(() => {
    setSelectedTaskId(null)
  }, [])

  // Handle opening a list item from the task modal (opens Legal Document Modal on top)
  const handleOpenListItemFromTask = useCallback((listItemId: string) => {
    setSelectedListItemId(listItemId)
  }, [])

  // Story 6.15: Handle task update - optimistically update task list in Law List Item Modal
  const handleTaskUpdate = useCallback(
    (taskId: string, updates: Record<string, unknown>) => {
      if (!selectedListItemId) return

      const cacheKey = `list-item-tasks:${selectedListItemId}`

      // Optimistically update the task in the cache
      globalMutate(
        cacheKey,
        (currentData: TaskProgress | undefined) => {
          if (!currentData) return currentData

          const updatedTasks = currentData.tasks.map((task) => {
            if (task.id !== taskId) return task

            // Map TaskModal updates to TaskSummary fields
            const updatedTask = { ...task }

            if ('title' in updates && typeof updates.title === 'string') {
              updatedTask.title = updates.title
            }

            if ('column' in updates && updates.column) {
              const col = updates.column as {
                id: string
                name: string
                color: string | null
                is_done: boolean
              }
              updatedTask.columnId = col.id
              updatedTask.columnName = col.name
              updatedTask.columnColor = col.color
              updatedTask.isDone = col.is_done
            }

            if ('assignee' in updates) {
              updatedTask.assignee = updates.assignee as {
                name: string | null
                avatarUrl: string | null
              } | null
            }

            return updatedTask
          })

          // Recalculate completed count
          const completed = updatedTasks.filter((t) => t.isDone).length

          return {
            ...currentData,
            completed,
            tasks: updatedTasks,
          }
        },
        { revalidate: false }
      )
    },
    [selectedListItemId, globalMutate]
  )

  // Story 6.2: Handle search from SearchInput component (already debounced)
  const handleSearch = useCallback(
    (query: string) => {
      setSearchQuery(query)
      startTransition(() => {
        const params = new URLSearchParams(searchParams.toString())
        if (query) {
          params.set('q', query)
        } else {
          params.delete('q')
        }
        const newUrl = `?${params.toString()}`
        const currentUrl = `?${searchParams.toString()}`
        if (newUrl !== currentUrl) {
          router.replace(newUrl, { scroll: false })
        }
      })
    },
    [searchParams, router]
  )

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
    columnSizing,
    setColumnSizing,
    // Story 6.18: Compliance view column visibility
    complianceColumnVisibility,
    setComplianceColumnVisibility,
    complianceColumnSizing,
    setComplianceColumnSizing,
    // Story 6.21: Column order (drag-to-reorder)
    columnOrder,
    setColumnOrder,
    complianceColumnOrder,
    setComplianceColumnOrder,
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
  // These selectors return a fresh object/array per call; wrap in useShallow
  // so React 19's useSyncExternalStore sees stable references and doesn't
  // loop. (React 19 is stricter about getSnapshot caching than 18.)
  const activeGroupFilterInfo = useDocumentListStore(
    useShallow(selectActiveGroupFilterInfo)
  )
  const filteredItems = useDocumentListStore(
    useShallow(selectFilteredByGroupItems)
  )

  // Handle list item change from modal - optimistically update document list table
  const handleListItemChange = useCallback(
    (
      listItemId: string,
      updates: {
        complianceStatus?: ComplianceStatus
        priority?: 'LOW' | 'MEDIUM' | 'HIGH'
        responsibleUserId?: string | null
        // Compliance content fields (optimistic update from modal)
        businessContext?: string | null
        complianceNarrative?: string | null
      }
    ) => {
      // Use the store's updateItem for optimistic update (no await needed for UI)
      updateItem(listItemId, updates)
    },
    [updateItem]
  )

  // Story 6.2: Initialize filters and search from URL on mount
  useEffect(() => {
    const urlFilters = parseFiltersFromUrl(searchParams)
    setComplianceFilters(urlFilters)
    const urlSearch = searchParams.get('q') ?? ''
    setSearchQuery(urlSearch)
    // Auto-open filter bar if URL has active filters
    if (checkHasActiveFilters(urlFilters)) {
      setIsFilterBarOpen(true)
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // Story 6.2: Client-side filtering of items (filters + search)
  const filteredAndSearchedItems = useMemo(() => {
    let items = activeGroupFilter ? filteredItems : listItems

    // Apply compliance status filter
    if (complianceFilters.complianceStatus.length > 0) {
      items = items.filter((item) =>
        complianceFilters.complianceStatus.includes(item.complianceStatus)
      )
    }

    // Apply category filter
    if (complianceFilters.category.length > 0) {
      items = items.filter(
        (item) =>
          item.category && complianceFilters.category.includes(item.category)
      )
    }

    // Apply responsible person filter
    if (complianceFilters.responsibleUserId) {
      items = items.filter(
        (item) =>
          item.responsibleUser?.id === complianceFilters.responsibleUserId
      )
    }

    // Apply search filter (title or document number)
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase().trim()
      items = items.filter(
        (item) =>
          item.document.title.toLowerCase().includes(query) ||
          item.document.documentNumber.toLowerCase().includes(query)
      )
    }

    return items
  }, [
    listItems,
    filteredItems,
    activeGroupFilter,
    complianceFilters,
    searchQuery,
  ])

  // Story 6.2: Extract unique categories from items
  const categories = useMemo(() => {
    const categorySet = new Set<string>()
    listItems.forEach((item) => {
      if (item.category) {
        categorySet.add(item.category)
      }
    })
    return Array.from(categorySet).sort()
  }, [listItems])

  // Story 6.2: Check if any filters or search are active
  const hasFiltersOrSearch = useMemo(
    () => checkHasActiveFilters(complianceFilters) || !!searchQuery.trim(),
    [complianceFilters, searchQuery]
  )

  // Active filter count for the filter bar badge
  const activeFilterCount = useMemo(() => {
    let count = 0
    if (contentTypeFilter && contentTypeFilter.length > 0) count++
    count += complianceFilters.complianceStatus.length
    count += complianceFilters.category.length
    if (complianceFilters.responsibleUserId) count++
    if (activeGroupFilter) count++
    return count
  }, [contentTypeFilter, complianceFilters, activeGroupFilter])

  // Story 6.3 Performance: Get selected item data for instant modal display
  const selectedItemInitialData = useMemo((): InitialListItemData | null => {
    if (!selectedListItemId) return null
    const item = listItems.find((i) => i.id === selectedListItemId)
    if (!item) return null

    return {
      id: item.id,
      position: item.position,
      complianceStatus: item.complianceStatus,
      priority: item.priority,
      category: item.category,
      addedAt: item.addedAt,
      dueDate: item.dueDate,
      responsibleUser: item.responsibleUser,
      // Story 8.1: Pass pending change count for modal banner
      pendingChangeCount: item.pendingChangeCount,
      document: {
        id: item.document.id,
        title: item.document.title,
        documentNumber: item.document.documentNumber,
        contentType: item.document.contentType,
        slug: item.document.slug,
        summary: item.document.summary,
        effectiveDate: item.document.effectiveDate,
        sourceUrl: item.document.sourceUrl,
        status: item.document.status,
      },
      lawList: {
        id: activeListId ?? '',
        name: activeList?.name ?? '',
      },
    }
  }, [selectedListItemId, listItems, activeListId, activeList])

  // Pre-fetch visible documents for instant modal opening
  usePrefetchDocuments(
    filteredAndSearchedItems.slice(0, 20).map((item) => ({
      id: item.id,
      document_id: item.document.id,
    })),
    { enabled: !isLoadingItems, delay: 800 }
  )

  // Clear all filters (for filter bar "Rensa" button)
  const clearAllFilters = useCallback(() => {
    setComplianceFilters({
      complianceStatus: [],
      category: [],
      responsibleUserId: null,
    })
    setContentTypeGroupFilter(null)
    clearGroupFilter()
    const params = new URLSearchParams(searchParams.toString())
    params.delete('status')
    params.delete('category')
    params.delete('responsible')
    // Must also drop the group param — otherwise the URL→store sync effect
    // (see groupIdFromUrl useEffect below) re-applies the group filter
    // immediately after we clear the store.
    params.delete('group')
    router.replace(`?${params.toString()}`, { scroll: false })
  }, [searchParams, router, setContentTypeGroupFilter, clearGroupFilter])

  // Story 6.2: Clear all filters and search
  const clearAllFiltersAndSearch = useCallback(() => {
    setComplianceFilters({
      complianceStatus: [],
      category: [],
      responsibleUserId: null,
    })
    setSearchQuery('')
    const params = new URLSearchParams(searchParams.toString())
    params.delete('status')
    params.delete('category')
    params.delete('responsible')
    params.delete('q')
    router.replace(`?${params.toString()}`, { scroll: false })
  }, [searchParams, router])

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

  // Story 6.3: Watch for document URL param changes (for modal)
  const documentIdFromUrl = searchParams.get('document')
  useEffect(() => {
    // Only sync from URL to state when they differ (e.g., browser back/forward)
    // This prevents double updates when we programmatically change the URL
    if (documentIdFromUrl !== selectedListItemId) {
      setSelectedListItemId(documentIdFromUrl)
    }
  }, [documentIdFromUrl]) // eslint-disable-line react-hooks/exhaustive-deps

  // Clear error on unmount
  useEffect(() => {
    return () => clearError()
  }, [clearError])

  // Fetch workspace members for assignee dropdown (Story 4.12)
  // Story 6.15: Also fetch task columns for TaskModal status dropdown
  useEffect(() => {
    async function fetchMembers() {
      const result = await getWorkspaceMembers()
      if (result.success && result.data) {
        setWorkspaceMembers(result.data)
      }
    }
    async function fetchColumns() {
      const result = await getTaskColumns()
      if (result.success && result.data) {
        setTaskColumns(result.data)
      }
    }
    fetchMembers()
    fetchColumns()
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
    setManageModalInitialStep(undefined)
    setIsManageModalOpen(true)
  }

  const handleEditList = () => {
    setManageModalMode('edit')
    setManageModalInitialStep(undefined)
    setIsManageModalOpen(true)
  }

  // Story 24.6 AC 7: empty-state link → open modal directly on import step.
  const handleOpenImport = () => {
    setManageModalMode('create')
    setManageModalInitialStep('import')
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

  // Story 4.12, 4.14 & 6.2: Handle inline item updates using store's optimistic method
  const handleUpdateItem = async (
    itemId: string,
    updates: {
      status?: LawListItemStatus
      priority?: LawListItemPriority
      dueDate?: Date | null
      assignedTo?: string | null
      groupId?: string | null
      complianceStatus?: ComplianceStatus
      responsibleUserId?: string | null
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

  // Story 4.12, 4.14 & 6.2: Handle bulk updates using store's optimistic method
  const handleTableBulkUpdate = async (
    itemIds: string[],
    updates: {
      status?: LawListItemStatus
      priority?: LawListItemPriority
      complianceStatus?: ComplianceStatus
      responsibleUserId?: string | null
    }
  ): Promise<boolean> => {
    // Story 4.14: Use store's optimistic bulk update (no refetch needed)
    return bulkUpdateItems(itemIds, updates)
  }

  // Story 24.6 AC 7: empty-state when the workspace has zero law lists.
  // Suppressed when the page already shows a pending-imports banner — the
  // banner above takes precedence as the next-step affordance.
  const hasNoLists = lists.length === 0 && !isLoadingLists && !hasPendingImports

  return (
    <div className="flex flex-col gap-4">
      {hasNoLists ? (
        <>
          <div className="border-b border-border/60 py-2">
            <LawListTabsStrip changeCount={initialChangeCount} />
          </div>
          <EmptyLawListState
            onCreateList={handleCreateList}
            onOpenImport={handleOpenImport}
          />
        </>
      ) : (
        <>
          {/* Toolbar redesign: single-row toolbar + collapsible filter bar */}
          <LawListToolbar
            tabsSlot={<LawListTabsStrip changeCount={initialChangeCount} />}
            listSwitcher={
              <DocumentListSwitcher
                lists={lists}
                activeListId={activeListId}
                onSelectList={handleListChange}
                onCreateList={handleCreateList}
                isLoading={isLoadingLists}
              />
            }
            search={
              <SearchInput
                initialValue={searchParams.get('q') ?? ''}
                onSearch={handleSearch}
                placeholder="Sök dokument..."
                className="w-full"
              />
            }
            filterCount={activeFilterCount}
            isFilterBarOpen={isFilterBarOpen}
            onToggleFilterBar={() => setIsFilterBarOpen((o) => !o)}
            viewMenu={
              <div className="flex items-center gap-2">
                {/* Standalone group-management trigger, mirroring the
                    Personalregister "Hantera grupper" toolbar button. */}
                <ManageLawGroupsPopover
                  open={Boolean(isGroupManagerOpen && activeListId)}
                  onOpenChange={setIsGroupManagerOpen}
                  listId={activeListId}
                  onGroupsUpdated={handleGroupsUpdated}
                />
                <ViewMenu
                  viewMode={viewMode}
                  onViewModeChange={setViewMode}
                  columnVisibility={columnVisibility}
                  onColumnVisibilityChange={setColumnVisibility}
                  complianceColumnVisibility={complianceColumnVisibility}
                  onComplianceColumnVisibilityChange={
                    setComplianceColumnVisibility
                  }
                  hasGroups={groups.length > 0}
                  onExpandAll={expandAllGroups}
                  onCollapseAll={collapseAllGroups}
                  listId={activeListId}
                  listName={activeList?.name ?? 'lista'}
                  exportDisabled={!activeListId || listItems.length === 0}
                />
              </div>
            }
            settingsAction={
              <Button
                variant="outline"
                size="icon"
                onClick={handleEditList}
                disabled={!activeListId}
                title="Hantera lista"
                className="h-9 w-9"
              >
                <Settings className="h-4 w-4" />
              </Button>
            }
            itemCount={
              viewMode === 'table' &&
              (groups.length === 0 ||
                hasFiltersOrSearch ||
                activeGroupFilter) ? (
                <ToolbarItemCount
                  showing={
                    hasFiltersOrSearch
                      ? filteredAndSearchedItems.length
                      : activeGroupFilter
                        ? filteredItems.length
                        : listItems.length
                  }
                  total={total}
                  label="dokument"
                />
              ) : undefined
            }
          />

          <FilterBar
            isOpen={isFilterBarOpen}
            contentTypeFilter={contentTypeFilter}
            onContentTypeChange={setContentTypeGroupFilter}
            complianceFilters={complianceFilters}
            onComplianceFiltersChange={setComplianceFilters}
            workspaceMembers={workspaceMembers}
            categories={categories}
            activeGroupFilterInfo={activeGroupFilterInfo}
            onClearGroupFilter={handleClearGroupFilter}
            activeFilterCount={activeFilterCount}
            onClearAll={clearAllFilters}
          />

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
          {/* Story 4.13 & 6.2: Use filtered items and show empty state when filters return no results */}
          {/* Story 6.14: Add grouped table view when in table mode with groups and no filters */}
          {/* Story 6.18: Add compliance detail view (Efterlevnad) */}
          {hasFiltersOrSearch &&
          filteredAndSearchedItems.length === 0 &&
          !isLoadingItems ? (
            <FilterEmptyState
              searchQuery={searchQuery}
              hasActiveFilters={checkHasActiveFilters(complianceFilters)}
              onClearFilters={clearAllFiltersAndSearch}
            />
          ) : activeListId &&
            total === 0 &&
            !activeGroupFilter &&
            !isLoadingItems ? (
            <EmptyState
              icon={
                <EmptyState.Icon>
                  <FileText className="h-8 w-8 text-muted-foreground" />
                </EmptyState.Icon>
              }
              title="Inga dokument i listan ännu"
              description="Lägg till relevanta regelverk eller importera en befintlig laglista för att komma igång."
              action={
                <div className="flex gap-2">
                  <LawListPrimaryAction />
                  <Button variant="outline" onClick={handleOpenImport}>
                    <Upload className="mr-2 h-4 w-4" />
                    Importera laglista
                  </Button>
                </div>
              }
            />
          ) : viewMode === 'card' &&
            groups.length > 0 &&
            !hasFiltersOrSearch &&
            !activeGroupFilter ? (
            // Story 28.10: card view = the SAME grouped tables forced into
            // the core's card renderer (cards show complianceStatus — the
            // legacy hand-made card's status divergence is retired).
            <GroupedDocumentListTable
              items={listItems}
              groups={groups}
              expandedGroups={expandedGroups}
              total={total}
              hasMore={hasMore}
              isLoading={isLoadingItems}
              columnVisibility={columnVisibility}
              onColumnVisibilityChange={setColumnVisibility}
              columnSizing={columnSizing}
              onColumnSizingChange={setColumnSizing}
              columnOrder={columnOrder}
              onColumnOrderChange={setColumnOrder}
              onLoadMore={loadMoreItems}
              onUpdateItem={handleUpdateItem}
              onBulkUpdate={handleTableBulkUpdate}
              onRemoveItem={removeItem}
              onReorderItems={reorderItems}
              onMoveToGroup={moveToGroup}
              onToggleGroup={toggleGroupExpanded}
              onExpandAll={expandAllGroups}
              onCollapseAll={collapseAllGroups}
              onFilterByGroup={handleFilterByGroup}
              onRowClick={handleOpenModal}
              workspaceMembers={workspaceMembers}
              forceCardView
              emptyMessage={
                activeListId
                  ? 'Inga dokument i denna lista. Lägg till dokument för att komma igång.'
                  : 'Välj eller skapa en lista för att komma igång.'
              }
            />
          ) : viewMode === 'card' ? (
            <DocumentListTable
              items={
                hasFiltersOrSearch
                  ? filteredAndSearchedItems
                  : activeGroupFilter
                    ? filteredItems
                    : listItems
              }
              total={
                hasFiltersOrSearch
                  ? filteredAndSearchedItems.length
                  : activeGroupFilter
                    ? filteredItems.length
                    : total
              }
              hasMore={
                hasFiltersOrSearch || activeGroupFilter ? false : hasMore
              }
              isLoading={isLoadingItems}
              columnVisibility={columnVisibility}
              onColumnVisibilityChange={setColumnVisibility}
              columnSizing={columnSizing}
              onColumnSizingChange={setColumnSizing}
              columnOrder={columnOrder}
              onColumnOrderChange={setColumnOrder}
              onLoadMore={loadMoreItems}
              onUpdateItem={handleUpdateItem}
              onBulkUpdate={handleTableBulkUpdate}
              onRemoveItem={removeItem}
              onReorderItems={reorderItems}
              workspaceMembers={workspaceMembers}
              groups={groups}
              onMoveToGroup={moveToGroup}
              onRowClick={handleOpenModal}
              forceCardView
              emptyMessage={
                activeListId
                  ? 'Inga dokument i denna lista. Lägg till dokument för att komma igång.'
                  : 'Välj eller skapa en lista för att komma igång.'
              }
            />
          ) : viewMode === 'compliance' &&
            groups.length > 0 &&
            !hasFiltersOrSearch &&
            !activeGroupFilter ? (
            // Story 6.18: Grouped compliance view with accordion structure
            <GroupedComplianceTable
              items={listItems}
              groups={groups}
              expandedGroups={expandedGroups}
              total={total}
              hasMore={hasMore}
              isLoading={isLoadingItems}
              columnVisibility={complianceColumnVisibility}
              onColumnVisibilityChange={setComplianceColumnVisibility}
              columnSizing={complianceColumnSizing}
              onColumnSizingChange={setComplianceColumnSizing}
              columnOrder={complianceColumnOrder}
              onColumnOrderChange={setComplianceColumnOrder}
              onLoadMore={loadMoreItems}
              onUpdateItem={handleUpdateItem}
              onBulkUpdate={handleTableBulkUpdate}
              onRemoveItem={removeItem}
              onReorderItems={reorderItems}
              onMoveToGroup={moveToGroup}
              onToggleGroup={toggleGroupExpanded}
              onExpandAll={expandAllGroups}
              onCollapseAll={collapseAllGroups}
              onFilterByGroup={handleFilterByGroup}
              onRowClick={handleOpenModal}
              onAddContent={handleAddContent}
              workspaceMembers={workspaceMembers}
              emptyMessage={
                activeListId
                  ? 'Inga dokument i denna lista. Lägg till dokument för att komma igång.'
                  : 'Välj eller skapa en lista för att komma igång.'
              }
              complianceReadOnly={complianceReadOnly}
            />
          ) : viewMode === 'compliance' ? (
            // Story 6.18: Flat compliance view (when no groups, or filters/search active)
            <ComplianceDetailTable
              items={
                hasFiltersOrSearch
                  ? filteredAndSearchedItems
                  : activeGroupFilter
                    ? filteredItems
                    : listItems
              }
              total={
                hasFiltersOrSearch
                  ? filteredAndSearchedItems.length
                  : activeGroupFilter
                    ? filteredItems.length
                    : total
              }
              hasMore={
                hasFiltersOrSearch || activeGroupFilter ? false : hasMore
              }
              isLoading={isLoadingItems}
              columnVisibility={complianceColumnVisibility}
              onColumnVisibilityChange={setComplianceColumnVisibility}
              columnSizing={complianceColumnSizing}
              onColumnSizingChange={setComplianceColumnSizing}
              columnOrder={complianceColumnOrder}
              onColumnOrderChange={setComplianceColumnOrder}
              workspaceMembers={workspaceMembers}
              onLoadMore={loadMoreItems}
              onRemoveItem={removeItem}
              onReorderItems={reorderItems}
              onUpdateItem={handleUpdateItem}
              onBulkUpdate={handleTableBulkUpdate}
              groups={groups}
              onMoveToGroup={moveToGroup}
              onRowClick={handleOpenModal}
              onAddContent={handleAddContent}
              emptyMessage={
                activeListId
                  ? 'Inga dokument i denna lista. Lägg till dokument för att komma igång.'
                  : 'Välj eller skapa en lista för att komma igång.'
              }
              complianceReadOnly={complianceReadOnly}
            />
          ) : viewMode === 'table' &&
            groups.length > 0 &&
            !hasFiltersOrSearch &&
            !activeGroupFilter ? (
            // Story 6.14: Grouped accordion tables for table view
            <GroupedDocumentListTable
              items={listItems}
              groups={groups}
              expandedGroups={expandedGroups}
              total={total}
              hasMore={hasMore}
              isLoading={isLoadingItems}
              columnVisibility={columnVisibility}
              onColumnVisibilityChange={setColumnVisibility}
              columnSizing={columnSizing}
              onColumnSizingChange={setColumnSizing}
              columnOrder={columnOrder}
              onColumnOrderChange={setColumnOrder}
              onLoadMore={loadMoreItems}
              onUpdateItem={handleUpdateItem}
              onBulkUpdate={handleTableBulkUpdate}
              onRemoveItem={removeItem}
              onReorderItems={reorderItems}
              onMoveToGroup={moveToGroup}
              onToggleGroup={toggleGroupExpanded}
              onExpandAll={expandAllGroups}
              onCollapseAll={collapseAllGroups}
              onFilterByGroup={handleFilterByGroup}
              onRowClick={handleOpenModal}
              workspaceMembers={workspaceMembers}
              emptyMessage={
                activeListId
                  ? 'Inga dokument i denna lista. Lägg till dokument för att komma igång.'
                  : 'Välj eller skapa en lista för att komma igång.'
              }
            />
          ) : (
            // Flat table view (when no groups, or filters/search active, or filtering by specific group)
            <DocumentListTable
              items={
                hasFiltersOrSearch
                  ? filteredAndSearchedItems
                  : activeGroupFilter
                    ? filteredItems
                    : listItems
              }
              total={
                hasFiltersOrSearch
                  ? filteredAndSearchedItems.length
                  : activeGroupFilter
                    ? filteredItems.length
                    : total
              }
              hasMore={
                hasFiltersOrSearch || activeGroupFilter ? false : hasMore
              }
              isLoading={isLoadingItems}
              columnVisibility={columnVisibility}
              onColumnVisibilityChange={setColumnVisibility}
              columnSizing={columnSizing}
              onColumnSizingChange={setColumnSizing}
              columnOrder={columnOrder}
              onColumnOrderChange={setColumnOrder}
              onLoadMore={loadMoreItems}
              onUpdateItem={handleUpdateItem}
              onBulkUpdate={handleTableBulkUpdate}
              onRemoveItem={removeItem}
              onReorderItems={reorderItems}
              workspaceMembers={workspaceMembers}
              groups={groups}
              onMoveToGroup={moveToGroup}
              // Story 6.3: Open legal document modal on row click (via URL)
              onRowClick={handleOpenModal}
              emptyMessage={
                activeListId
                  ? 'Inga dokument i denna lista. Lägg till dokument för att komma igång.'
                  : 'Välj eller skapa en lista för att komma igång.'
              }
            />
          )}
        </>
      )}

      {/* Manage list modal */}
      <ManageListModal
        open={isManageModalOpen}
        onOpenChange={setIsManageModalOpen}
        mode={manageModalMode}
        list={manageModalMode === 'edit' ? activeList : undefined}
        templates={publishedTemplates}
        initialStep={manageModalInitialStep}
        onCreated={handleListCreated}
        onUpdated={handleListUpdated}
        onDeleted={handleListDeleted}
      />

      {/* Story 6.3: Legal document modal - pass initialData for instant display */}
      <LegalDocumentModal
        listItemId={selectedListItemId}
        onClose={handleCloseModal}
        initialData={selectedItemInitialData}
        workspaceMembers={workspaceMembers}
        onOpenTask={handleOpenTask}
        taskColumns={taskColumns}
        onListItemChange={handleListItemChange}
        focusField={focusField}
        complianceReadOnly={complianceReadOnly}
      />

      {/* Story 6.15: Task modal for bidirectional linking */}
      <TaskModal
        taskId={selectedTaskId}
        onClose={handleCloseTaskModal}
        workspaceMembers={workspaceMembers}
        columns={taskColumns}
        onTaskUpdate={handleTaskUpdate}
        onOpenListItem={handleOpenListItemFromTask}
      />
    </div>
  )
}
