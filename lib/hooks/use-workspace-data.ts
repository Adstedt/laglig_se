/**
 * useWorkspaceData Hook (Story P.2)
 * 
 * React hook that manages workspace data fetching with caching.
 * Coordinates between client-side store and server-side cache.
 * 
 * @see docs/stories/P.2.systematic-caching.story.md
 */

'use client'

import { useEffect, useCallback, useRef } from 'react'
import { useWorkspaceStore } from '@/lib/stores/workspace-store'
import type { 
  Workspace, 
  WorkspaceMember, 
  LawList,
  WorkspaceRole 
} from '@prisma/client'

interface UseWorkspaceDataOptions {
  workspaceId?: string
  fetchMembers?: boolean
  fetchLists?: boolean
  refreshInterval?: number // in milliseconds
}

interface WorkspaceDataHook {
  workspace: Workspace | null
  members: WorkspaceMember[]
  lawLists: LawList[]
  role: WorkspaceRole | null
  isLoading: {
    workspace: boolean
    members: boolean
    lists: boolean
  }
  refetch: {
    members: () => Promise<void>
    lists: () => Promise<void>
    all: () => Promise<void>
  }
  isCached: {
    members: boolean
    lists: boolean
  }
}

/**
 * Custom hook to manage workspace data with caching
 * Implements AC: 8 - Sub-100ms response for cached workspace navigation
 */
export function useWorkspaceData(
  options: UseWorkspaceDataOptions = {}
): WorkspaceDataHook {
  const {
    workspaceId,
    fetchMembers = true,
    fetchLists = true,
    refreshInterval,
  } = options
  
  const {
    currentWorkspace,
    currentRole,
    members,
    lawLists,
    isLoadingWorkspace,
    isLoadingMembers,
    isLoadingLists,
    shouldRefetchMembers,
    shouldRefetchLists,
    setMembers,
    setLawLists,
    setLoadingMembers,
    setLoadingLists,
  } = useWorkspaceStore()
  
  const intervalRef = useRef<NodeJS.Timeout | undefined>(undefined)
  const fetchInProgressRef = useRef({
    members: false,
    lists: false,
  })
  
  /**
   * Fetch workspace members from API
   */
  const fetchWorkspaceMembers = useCallback(async () => {
    if (!workspaceId || fetchInProgressRef.current.members) return
    
    fetchInProgressRef.current.members = true
    setLoadingMembers(true)
    
    const startTime = performance.now()
    
    try {
      const response = await fetch(`/api/workspace/${workspaceId}/members`)
      if (response.ok) {
        const data = await response.json()
        setMembers(data.members)
        
        const duration = performance.now() - startTime
        if (duration < 100) {
          console.log(`[CACHE HIT] Members loaded in ${duration.toFixed(2)}ms`)
        }
      }
    } catch (error) {
      console.error('[WORKSPACE DATA] Failed to fetch members:', error)
    } finally {
      setLoadingMembers(false)
      fetchInProgressRef.current.members = false
    }
  }, [workspaceId, setMembers, setLoadingMembers])
  
  /**
   * Fetch law lists from API
   */
  const fetchLawLists = useCallback(async () => {
    if (!workspaceId || fetchInProgressRef.current.lists) return
    
    fetchInProgressRef.current.lists = true
    setLoadingLists(true)
    
    const startTime = performance.now()
    
    try {
      const response = await fetch(`/api/workspace/${workspaceId}/lists`)
      if (response.ok) {
        const data = await response.json()
        setLawLists(data.lists)
        
        const duration = performance.now() - startTime
        if (duration < 100) {
          console.log(`[CACHE HIT] Lists loaded in ${duration.toFixed(2)}ms`)
        }
      }
    } catch (error) {
      console.error('[WORKSPACE DATA] Failed to fetch lists:', error)
    } finally {
      setLoadingLists(false)
      fetchInProgressRef.current.lists = false
    }
  }, [workspaceId, setLawLists, setLoadingLists])
  
  /**
   * Check if data needs refetching based on cache TTL
   */
  const checkAndFetchData = useCallback(async () => {
    const tasks: Promise<void>[] = []
    
    if (fetchMembers && shouldRefetchMembers && shouldRefetchMembers()) {
      tasks.push(fetchWorkspaceMembers())
    }
    
    if (fetchLists && shouldRefetchLists && shouldRefetchLists()) {
      tasks.push(fetchLawLists())
    }
    
    if (tasks.length > 0) {
      await Promise.all(tasks)
    }
  }, [
    fetchMembers,
    fetchLists,
    shouldRefetchMembers,
    shouldRefetchLists,
    fetchWorkspaceMembers,
    fetchLawLists,
  ])
  
  /**
   * Force refetch functions
   */
  const refetchMembers = useCallback(async () => {
    await fetchWorkspaceMembers()
  }, [fetchWorkspaceMembers])
  
  const refetchLists = useCallback(async () => {
    await fetchLawLists()
  }, [fetchLawLists])
  
  const refetchAll = useCallback(async () => {
    await Promise.all([
      fetchMembers ? fetchWorkspaceMembers() : Promise.resolve(),
      fetchLists ? fetchLawLists() : Promise.resolve(),
    ])
  }, [fetchMembers, fetchLists, fetchWorkspaceMembers, fetchLawLists])
  
  /**
   * Initial data fetch and refresh interval
   */
  useEffect(() => {
    if (workspaceId || currentWorkspace) {
      // Initial fetch
      checkAndFetchData()
      
      // Set up refresh interval if specified
      if (refreshInterval) {
        intervalRef.current = setInterval(() => {
          checkAndFetchData()
        }, refreshInterval)
      }
    }
    
    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current)
      }
    }
  }, [workspaceId, currentWorkspace, refreshInterval, checkAndFetchData])
  
  return {
    workspace: currentWorkspace,
    members,
    lawLists,
    role: currentRole,
    isLoading: {
      workspace: isLoadingWorkspace,
      members: isLoadingMembers,
      lists: isLoadingLists,
    },
    refetch: {
      members: refetchMembers,
      lists: refetchLists,
      all: refetchAll,
    },
    isCached: {
      members: shouldRefetchMembers ? !shouldRefetchMembers() : false,
      lists: shouldRefetchLists ? !shouldRefetchLists() : false,
    },
  }
}

/**
 * Hook to prefetch workspace data for faster navigation
 * Implements cache warming for anticipated user actions
 */
export function usePrefetchWorkspaceData() {
  const setMembers = useWorkspaceStore((state) => state.setMembers)
  const setLawLists = useWorkspaceStore((state) => state.setLawLists)
  
  const prefetchWorkspace = useCallback(
    async (workspaceId: string) => {
      try {
        // Fetch members and lists in parallel
        const [membersRes, listsRes] = await Promise.all([
          fetch(`/api/workspace/${workspaceId}/members`),
          fetch(`/api/workspace/${workspaceId}/lists`),
        ])
        
        if (membersRes.ok) {
          const membersData = await membersRes.json()
          setMembers(membersData.members)
        }
        
        if (listsRes.ok) {
          const listsData = await listsRes.json()
          setLawLists(listsData.lists)
        }
      } catch (error) {
        console.error('[PREFETCH] Failed to prefetch workspace:', error)
      }
    },
    [setMembers, setLawLists]
  )
  
  return { prefetchWorkspace }
}

/**
 * Hook to track workspace data performance
 */
export function useWorkspacePerformance() {
  const performanceRef = useRef({
    fetchCount: 0,
    cacheHits: 0,
    totalDuration: 0,
  })
  
  const trackPerformance = useCallback((cached: boolean, duration: number) => {
    performanceRef.current.fetchCount++
    if (cached) {
      performanceRef.current.cacheHits++
    }
    performanceRef.current.totalDuration += duration
  }, [])
  
  const getMetrics = useCallback(() => {
    const { fetchCount, cacheHits, totalDuration } = performanceRef.current
    return {
      fetchCount,
      cacheHits,
      cacheHitRate: fetchCount > 0 ? (cacheHits / fetchCount) * 100 : 0,
      averageDuration: fetchCount > 0 ? totalDuration / fetchCount : 0,
    }
  }, [])
  
  const resetMetrics = useCallback(() => {
    performanceRef.current = {
      fetchCount: 0,
      cacheHits: 0,
      totalDuration: 0,
    }
  }, [])
  
  return {
    trackPerformance,
    getMetrics,
    resetMetrics,
  }
}