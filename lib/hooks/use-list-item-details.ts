'use client'

import { useRef, useEffect } from 'react'
import useSWR from 'swr'
import {
  getListItemDetails,
  getTasksForListItem,
  getEvidenceForListItem,
  type ListItemDetails,
  type TaskProgress,
  type EvidenceSummary,
} from '@/app/actions/legal-document-modal'
import { getWorkspaceMembers } from '@/app/actions/document-list'
import type { WorkspaceMemberOption } from '@/app/actions/document-list'

interface UseListItemDetailsResult {
  listItem: ListItemDetails | null
  taskProgress: TaskProgress | null
  evidence: EvidenceSummary[] | null
  workspaceMembers: WorkspaceMemberOption[]
  isLoading: boolean
  error: string | null
  mutate: () => Promise<void>
  mutateTaskProgress: () => Promise<void>
}

/**
 * SWR hook for fetching and caching list item details
 *
 * Features:
 * - Caches data so second modal open is instant
 * - Stale-while-revalidate: Shows cached data immediately
 * - Automatic revalidation in background
 */
export function useListItemDetails(
  listItemId: string | null
): UseListItemDetailsResult {
  // Use ref to persist start time across re-renders
  const startTimeRef = useRef<number | null>(null)
  
  // Set start time only once when modal opens
  useEffect(() => {
    if (listItemId && !startTimeRef.current) {
      startTimeRef.current = Date.now()
      console.log(`🎬 [CLIENT] Modal loading started for ${listItemId}`)
      console.log(`🎬 [CLIENT] Time: ${new Date().toISOString()}`)
      // Also store globally for modal component
      ;(window as any).__modalStartTime = startTimeRef.current
    } else if (!listItemId) {
      // Reset when modal closes
      startTimeRef.current = null
      ;(window as any).__modalStartTime = null
    }
  }, [listItemId])
  
  // Fetch list item details
  const {
    data: listItemData,
    error: listItemError,
    isLoading: listItemLoading,
    mutate: mutateListItem,
  } = useSWR(
    listItemId ? `list-item:${listItemId}` : null,
    async () => {
      const fetchStart = Date.now()
      console.log(`🎬 [CLIENT] Starting main data fetch...`)
      
      const result = await getListItemDetails(listItemId!)
      
      const fetchTime = Date.now() - fetchStart
      console.log(`🎬 [CLIENT] Main data fetch completed in ${fetchTime}ms`)
      
      if (!result.success || !result.data) {
        throw new Error(result.error ?? 'Kunde inte ladda dokumentet')
      }
      return result.data
    },
    {
      revalidateOnFocus: false,
      revalidateOnReconnect: false,
      dedupingInterval: 30000, // 30 seconds
    }
  )

  // TEMPORARILY DISABLED: Tasks and Evidence fetching to test performance
  // These were taking 4-5 seconds and blocking the modal
  
  /*
  // Fetch task progress
  const { data: taskData, mutate: mutateTaskProgress } = useSWR(
    listItemId ? `list-item-tasks:${listItemId}` : null,
    async () => {
      const taskStart = Date.now()
      console.log(`🎬 [CLIENT] Starting tasks fetch...`)
      
      const result = await getTasksForListItem(listItemId!)
      
      console.log(`🎬 [CLIENT] Tasks fetch completed in ${Date.now() - taskStart}ms`)
      return result.success ? (result.data ?? null) : null
    },
    {
      revalidateOnFocus: false,
      dedupingInterval: 30000,
    }
  )

  // Fetch evidence
  const { data: evidenceData } = useSWR(
    listItemId ? `list-item-evidence:${listItemId}` : null,
    async () => {
      const evidenceStart = Date.now()
      console.log(`🎬 [CLIENT] Starting evidence fetch...`)
      
      const result = await getEvidenceForListItem(listItemId!)
      
      console.log(`🎬 [CLIENT] Evidence fetch completed in ${Date.now() - evidenceStart}ms`)
      return result.success ? (result.data ?? null) : null
    },
    {
      revalidateOnFocus: false,
      dedupingInterval: 30000,
    }
  )
  */
  
  // Temporarily return null for tasks and evidence
  const taskData = null
  const evidenceData = null
  const mutateTaskProgress = async () => {}

  // Fetch workspace members (shared across all modals)
  const { data: membersData } = useSWR(
    listItemId ? 'workspace-members' : null,
    async () => {
      const result = await getWorkspaceMembers()
      return result.success ? (result.data ?? []) : []
    },
    {
      revalidateOnFocus: false,
      dedupingInterval: 60000, // 1 minute - members don't change often
    }
  )

  // Wrap mutate functions to return Promise<void> for compatibility
  const handleMutate = async () => {
    await mutateListItem()
  }

  const handleMutateTaskProgress = async () => {
    await mutateTaskProgress()
  }

  return {
    listItem: listItemData ?? null,
    taskProgress: taskData ?? null,
    evidence: evidenceData ?? null,
    workspaceMembers: membersData ?? [],
    isLoading: listItemLoading,
    error: listItemError?.message ?? null,
    mutate: handleMutate,
    mutateTaskProgress: handleMutateTaskProgress,
  }
}
