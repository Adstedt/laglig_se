'use client'

/**
 * SWR hooks for file browser with caching
 * Provides instant back-navigation and background revalidation
 */

import useSWR from 'swr'
import {
  getFolderTree,
  getFolderContents,
  getFolderPath,
} from '@/app/actions/files'
import type {
  FolderTreeNode,
  FolderInfo,
  WorkspaceFileWithLinks,
  FileFilters,
  BreadcrumbSegment,
} from '@/app/actions/files'

// ============================================================================
// Types
// ============================================================================

interface FolderContentsData {
  folders: FolderInfo[]
  files: WorkspaceFileWithLinks[]
  pagination: {
    page: number
    limit: number
    total: number
    totalPages: number
    hasNext: boolean
    hasPrev: boolean
  }
}

interface UseFolderContentsOptions {
  filters?: FileFilters
  page?: number
  limit?: number
}

// ============================================================================
// Fetchers
// ============================================================================

const folderTreeFetcher = async (): Promise<FolderTreeNode[]> => {
  const result = await getFolderTree()
  if (result.success && result.data) {
    return result.data
  }
  throw new Error(result.error || 'Failed to load folder tree')
}

const folderContentsFetcher = async (
  folderId: string | null,
  filters: FileFilters,
  page: number,
  limit: number
): Promise<FolderContentsData> => {
  const result = await getFolderContents(folderId, {
    filters,
    pagination: { page, limit },
  })
  if (result.success && result.data) {
    return result.data
  }
  throw new Error(result.error || 'Failed to load folder contents')
}

const folderPathFetcher = async (
  folderId: string | null
): Promise<BreadcrumbSegment[]> => {
  if (folderId === null) {
    return [{ id: null, name: 'Mina filer', path: '/documents' }]
  }
  const result = await getFolderPath(folderId)
  if (result.success && result.data) {
    return result.data
  }
  throw new Error(result.error || 'Failed to load folder path')
}

// ============================================================================
// Hooks
// ============================================================================

/**
 * Hook for folder tree with caching
 * - Cached across navigations
 * - Revalidates on focus
 */
export function useFolderTree() {
  const { data, error, isLoading, mutate } = useSWR<FolderTreeNode[]>(
    'folder-tree',
    folderTreeFetcher,
    {
      revalidateOnFocus: false,
      revalidateOnReconnect: true,
      dedupingInterval: 5000,
    }
  )

  return {
    folderTree: data ?? [],
    isLoading,
    error,
    refresh: mutate,
  }
}

/**
 * Hook for folder contents with caching
 * - Cached per folder + filters + page
 * - Stale-while-revalidate for instant navigation
 */
export function useFolderContents(
  folderId: string | null,
  options: UseFolderContentsOptions = {}
) {
  const { filters = {}, page = 1, limit = 24 } = options

  // Build cache key from all parameters
  const cacheKey = JSON.stringify([
    'folder-contents',
    folderId,
    filters,
    page,
    limit,
  ])

  const { data, error, isLoading, isValidating, mutate } =
    useSWR<FolderContentsData>(
      cacheKey,
      () => folderContentsFetcher(folderId, filters, page, limit),
      {
        revalidateOnFocus: false,
        keepPreviousData: true, // Show old data while loading new
        dedupingInterval: 2000,
      }
    )

  return {
    folders: data?.folders ?? [],
    files: data?.files ?? [],
    pagination: data?.pagination ?? {
      page: 1,
      limit: 24,
      total: 0,
      totalPages: 0,
      hasNext: false,
      hasPrev: false,
    },
    isLoading,
    isValidating, // True when revalidating in background
    error,
    refresh: mutate,
  }
}

/**
 * Build breadcrumb path optimistically from folder tree
 */
function buildBreadcrumbsFromTree(
  folderTree: FolderTreeNode[],
  targetId: string | null
): BreadcrumbSegment[] | null {
  if (targetId === null) {
    return [{ id: null, name: 'Mina filer', path: '/documents' }]
  }

  // Recursively find path to target folder
  const findPath = (
    nodes: FolderTreeNode[],
    target: string,
    currentPath: string,
    ancestors: BreadcrumbSegment[]
  ): BreadcrumbSegment[] | null => {
    for (const node of nodes) {
      const nodePath = `${currentPath}/${encodeURIComponent(node.name)}`
      const nodeSegment: BreadcrumbSegment = {
        id: node.id,
        name: node.name,
        path: nodePath,
      }

      if (node.id === target) {
        return [...ancestors, nodeSegment]
      }

      if (node.children.length > 0) {
        const found = findPath(node.children, target, nodePath, [
          ...ancestors,
          nodeSegment,
        ])
        if (found) return found
      }
    }
    return null
  }

  const root: BreadcrumbSegment = {
    id: null,
    name: 'Mina filer',
    path: '/documents',
  }
  const path = findPath(folderTree, targetId, '/documents', [root])
  return path
}

/**
 * Hook for breadcrumb path with optimistic updates
 * Uses folder tree to build path instantly, then validates with server
 */
export function useFolderPath(
  folderId: string | null,
  folderTree: FolderTreeNode[] = []
) {
  // Build optimistic breadcrumbs from folder tree
  const optimisticBreadcrumbs = buildBreadcrumbsFromTree(folderTree, folderId)
  const defaultBreadcrumbs: BreadcrumbSegment[] = [
    { id: null, name: 'Mina filer', path: '/documents' },
  ]

  const { data, error, isLoading } = useSWR<BreadcrumbSegment[]>(
    ['folder-path', folderId],
    () => folderPathFetcher(folderId),
    {
      revalidateOnFocus: false,
      dedupingInterval: 10000,
      // Use optimistic data for instant updates - fallback to default if no optimistic data
      fallbackData: optimisticBreadcrumbs ?? defaultBreadcrumbs,
    }
  )

  return {
    breadcrumbs: data ?? optimisticBreadcrumbs ?? defaultBreadcrumbs,
    isLoading: isLoading && !optimisticBreadcrumbs,
    error,
  }
}

/**
 * Invalidate all folder-related caches
 * Call after mutations (upload, delete, move, create folder)
 */
export function useInvalidateFolderCache() {
  const { mutate } = useSWR('folder-tree')

  return async () => {
    // Revalidate all folder-related caches
    await mutate()
  }
}
