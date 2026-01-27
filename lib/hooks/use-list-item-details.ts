'use client'

import { useMemo } from 'react'
import useSWR from 'swr'
import {
  getListItemDetails,
  getDocumentContent,
  getTasksForListItem,
  type ListItemDetails,
  type TaskProgress,
  type EvidenceSummary,
} from '@/app/actions/legal-document-modal'
import { getWorkspaceMembers } from '@/app/actions/document-list'
import type { WorkspaceMemberOption } from '@/app/actions/document-list'

// ============================================================================
// Exported Types
// ============================================================================

/**
 * Initial data from list view - used for instant modal display
 * Maps from DocumentListItem fields
 */
export interface InitialListItemData {
  id: string
  position: number
  complianceStatus: string
  category: string | null
  addedAt: Date
  dueDate: Date | null
  responsibleUser: {
    id: string
    name: string | null
    email: string
    avatarUrl: string | null
  } | null
  document: {
    id: string
    title: string
    documentNumber: string
    contentType: string
    slug: string
    summary: string | null
    effectiveDate: Date | null
    // These may be missing from list view - fetched separately
    sourceUrl?: string | null
    status?: string
  }
  lawList: {
    id: string
    name: string
  }
}

export interface WorkspaceMember {
  id: string
  name: string | null
  email: string
  avatarUrl: string | null
}

interface UseListItemDetailsResult {
  listItem: ListItemDetails | null
  taskProgress: TaskProgress | null
  evidence: EvidenceSummary[] | null
  workspaceMembers: WorkspaceMemberOption[]
  isLoading: boolean
  isLoadingContent: boolean
  error: string | null
  mutate: () => Promise<void>
  mutateTaskProgress: () => Promise<void>
}

/**
 * Convert initial data from list view to ListItemDetails format
 */
function initialDataToListItem(
  initial: InitialListItemData,
  htmlContent: string | null,
  extraData?: { businessContext?: string | null; aiCommentary?: string | null }
): ListItemDetails {
  return {
    id: initial.id,
    position: initial.position,
    complianceStatus:
      initial.complianceStatus as ListItemDetails['complianceStatus'],
    businessContext: extraData?.businessContext ?? null,
    aiCommentary: extraData?.aiCommentary ?? null,
    category: initial.category,
    addedAt: initial.addedAt,
    updatedAt: initial.addedAt, // Use addedAt as fallback
    dueDate: initial.dueDate,
    legalDocument: {
      id: initial.document.id,
      title: initial.document.title,
      documentNumber: initial.document.documentNumber,
      htmlContent,
      summary: initial.document.summary,
      slug: initial.document.slug,
      status: initial.document.status ?? 'ACTIVE',
      sourceUrl: initial.document.sourceUrl ?? null,
      contentType: initial.document.contentType,
      effectiveDate: initial.document.effectiveDate,
    },
    lawList: initial.lawList,
    responsibleUser: initial.responsibleUser,
  }
}

/**
 * SWR hook for fetching and caching list item details
 *
 * Performance optimization:
 * - If initialData is provided, displays instantly without loading state
 * - Only fetches htmlContent separately (lazy load)
 * - Uses preloadedMembers if provided (fetch once at page level)
 * - Caches data so subsequent modal opens are instant
 */
export function useListItemDetails(
  listItemId: string | null,
  initialData?: InitialListItemData | null,
  preloadedMembers?: WorkspaceMember[]
): UseListItemDetailsResult {
  // Fetch full list item details (only if no initialData)
  const {
    data: fullData,
    error: fullDataError,
    isLoading: isLoadingFullData,
    mutate: mutateFullData,
  } = useSWR(
    // Only fetch if we don't have initialData
    listItemId && !initialData ? `list-item:${listItemId}` : null,
    async () => {
      const result = await getListItemDetails(listItemId!)
      if (!result.success || !result.data) {
        throw new Error(result.error ?? 'Kunde inte ladda dokumentet')
      }
      return result.data
    },
    {
      revalidateOnFocus: false,
      revalidateOnReconnect: false,
      dedupingInterval: 30000,
    }
  )

  // Fetch HTML content separately (always needed, as list doesn't have it)
  const documentId = initialData?.document.id ?? fullData?.legalDocument.id
  const { data: contentData, isLoading: isLoadingContent } = useSWR(
    listItemId && documentId ? `document-content:${documentId}` : null,
    async () => {
      const result = await getDocumentContent(documentId!)
      if (!result.success || !result.data) {
        return { htmlContent: null }
      }
      return result.data
    },
    {
      revalidateOnFocus: false,
      revalidateOnReconnect: false,
      dedupingInterval: 60000, // 1 minute - content doesn't change
    }
  )

  // Fetch extra fields not in list (businessContext, aiCommentary)
  // Only if we have initialData (otherwise fullData has everything)
  const { data: extraFields } = useSWR(
    listItemId && initialData ? `list-item-extra:${listItemId}` : null,
    async () => {
      const result = await getListItemDetails(listItemId!)
      if (!result.success || !result.data) {
        return { businessContext: null, aiCommentary: null }
      }
      return {
        businessContext: result.data.businessContext,
        aiCommentary: result.data.aiCommentary,
      }
    },
    {
      revalidateOnFocus: false,
      revalidateOnReconnect: false,
      dedupingInterval: 30000,
    }
  )

  // Story 6.15: Re-enabled task fetching for bidirectional linking
  const { data: taskData, mutate: mutateTaskData } = useSWR(
    listItemId ? `list-item-tasks:${listItemId}` : null,
    async () => {
      const result = await getTasksForListItem(listItemId!)
      if (!result.success) {
        return null
      }
      return result.data
    },
    {
      revalidateOnFocus: false,
      revalidateOnReconnect: false,
      dedupingInterval: 10000, // 10 seconds
    }
  )

  // Evidence still disabled for now
  const evidenceData = null

  // Fetch workspace members only if not preloaded
  const { data: fetchedMembers } = useSWR(
    listItemId && !preloadedMembers ? 'workspace-members' : null,
    async () => {
      const result = await getWorkspaceMembers()
      return result.success ? (result.data ?? []) : []
    },
    {
      revalidateOnFocus: false,
      dedupingInterval: 60000,
    }
  )

  // Merge data: prefer initialData + content, fall back to fullData
  const listItem = useMemo(() => {
    if (initialData) {
      // Use initialData with fetched content merged in
      return initialDataToListItem(
        initialData,
        contentData?.htmlContent ?? null,
        extraFields
      )
    }
    if (fullData) {
      // Use full data (already has everything including content)
      return fullData
    }
    return null
  }, [initialData, fullData, contentData, extraFields])

  // Use preloaded members if available, otherwise fetched
  // WorkspaceMemberOption has: id, name, email, avatarUrl
  const workspaceMembers = useMemo(() => {
    if (preloadedMembers) {
      // preloadedMembers already match WorkspaceMemberOption format
      return preloadedMembers as WorkspaceMemberOption[]
    }
    return fetchedMembers ?? []
  }, [preloadedMembers, fetchedMembers])

  const handleMutate = async () => {
    await mutateFullData()
  }

  const handleMutateTaskProgress = async () => {
    await mutateTaskData()
  }

  // Loading state: only show loading if we have no data to display
  // With initialData, we can show content immediately
  const isLoading = !initialData && isLoadingFullData

  return {
    listItem,
    taskProgress: taskData ?? null,
    evidence: evidenceData ?? null,
    workspaceMembers,
    isLoading,
    isLoadingContent,
    error: fullDataError?.message ?? null,
    mutate: handleMutate,
    mutateTaskProgress: handleMutateTaskProgress,
  }
}
