'use client'

/**
 * Story 6.7b: Folder Tree Sidebar Component
 * AC: 4, 29, 35 - Collapsible tree view with lazy loading and accessibility
 * Dropbox-inspired clean design with smooth animations
 */

import { useState, useCallback, useEffect, useRef, KeyboardEvent } from 'react'
import { ChevronRight, Folder, FolderOpen, Home, Clock } from 'lucide-react'
import { cn } from '@/lib/utils'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Skeleton } from '@/components/ui/skeleton'
import type { FolderTreeNode } from '@/app/actions/files'

// ============================================================================
// Types
// ============================================================================

interface FolderTreeProps {
  folders: FolderTreeNode[]
  currentFolderId: string | null
  recentFolders?: Array<{ id: string; name: string }>
  onFolderSelect: (_folderId: string | null) => void
  onDragOver?: (_folderId: string | null) => void
  onDrop?: (_folderId: string | null) => void
  className?: string
}

interface FolderTreeNodeProps {
  node: FolderTreeNode
  depth: number
  currentFolderId: string | null
  expandedIds: Set<string>
  focusedId: string | null
  onToggle: (_id: string) => void
  onSelect: (_id: string | null) => void
  onFocus: (_id: string | null) => void
  onDragOver: ((_id: string | null) => void) | undefined
  onDrop: ((_id: string | null) => void) | undefined
  dragOverId: string | null
}

// ============================================================================
// FolderTreeNode Component - Dropbox-inspired clean design
// ============================================================================

function FolderTreeNodeItem({
  node,
  depth,
  currentFolderId,
  expandedIds,
  focusedId,
  onToggle,
  onSelect,
  onFocus,
  onDragOver,
  onDrop,
  dragOverId,
}: FolderTreeNodeProps) {
  const isExpanded = expandedIds.has(node.id)
  const isSelected = currentFolderId === node.id
  const isFocused = focusedId === node.id
  const isDragOver = dragOverId === node.id
  const nodeRef = useRef<HTMLButtonElement>(null)

  // Focus management
  useEffect(() => {
    if (isFocused && nodeRef.current) {
      nodeRef.current.focus()
    }
  }, [isFocused])

  const handleKeyDown = (e: KeyboardEvent<HTMLButtonElement>) => {
    switch (e.key) {
      case 'Enter':
      case ' ':
        e.preventDefault()
        onSelect(node.id)
        break
      case 'ArrowRight':
        e.preventDefault()
        if (node.hasChildren && !isExpanded) {
          onToggle(node.id)
        } else if (node.children.length > 0 && isExpanded) {
          onFocus(node.children[0]?.id ?? null)
        }
        break
      case 'ArrowLeft':
        e.preventDefault()
        if (isExpanded) {
          onToggle(node.id)
        }
        break
    }
  }

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    onDragOver?.(node.id)
  }

  const handleDragLeave = () => {
    onDragOver?.(null)
  }

  const handleDropEvent = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    onDrop?.(node.id)
  }

  const handleToggleClick = (e: React.MouseEvent) => {
    e.stopPropagation()
    onToggle(node.id)
  }

  return (
    <div className="select-none">
      {/* Folder row */}
      <button
        ref={nodeRef}
        type="button"
        className={cn(
          'group w-full flex items-center gap-1.5 py-1.5 px-2 rounded-md text-sm transition-all duration-150',
          'hover:bg-accent/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1',
          isSelected && 'bg-accent text-accent-foreground font-medium',
          isDragOver && 'ring-2 ring-primary bg-primary/5'
        )}
        style={{ paddingLeft: `${depth * 16 + 8}px` }}
        onClick={() => onSelect(node.id)}
        onKeyDown={handleKeyDown}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDropEvent}
        aria-expanded={node.hasChildren ? isExpanded : undefined}
        aria-current={isSelected ? 'page' : undefined}
        tabIndex={isFocused ? 0 : -1}
      >
        {/* Expand/Collapse chevron */}
        <span
          role="button"
          tabIndex={-1}
          className={cn(
            'flex items-center justify-center w-4 h-4 rounded transition-colors',
            node.hasChildren
              ? 'hover:bg-muted cursor-pointer'
              : 'opacity-0 pointer-events-none'
          )}
          onClick={node.hasChildren ? handleToggleClick : undefined}
          onKeyDown={
            node.hasChildren
              ? (e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault()
                    onToggle(node.id)
                  }
                }
              : undefined
          }
          aria-label={isExpanded ? 'Fäll ihop' : 'Expandera'}
        >
          <ChevronRight
            className={cn(
              'h-3.5 w-3.5 text-muted-foreground/70 transition-transform duration-200',
              isExpanded && 'rotate-90'
            )}
          />
        </span>

        {/* Folder icon */}
        <span className="flex-shrink-0">
          {isExpanded ? (
            <FolderOpen className="h-4 w-4 text-blue-500" />
          ) : (
            <Folder className="h-4 w-4 text-blue-500" />
          )}
        </span>

        {/* Folder name */}
        <span className="truncate text-left">{node.name}</span>
      </button>

      {/* Children with smooth height animation */}
      <div
        className={cn(
          'overflow-hidden transition-all duration-200',
          isExpanded ? 'opacity-100' : 'opacity-0 h-0'
        )}
      >
        {isExpanded &&
          node.children.map((child) => (
            <FolderTreeNodeItem
              key={child.id}
              node={child}
              depth={depth + 1}
              currentFolderId={currentFolderId}
              expandedIds={expandedIds}
              focusedId={focusedId}
              onToggle={onToggle}
              onSelect={onSelect}
              onFocus={onFocus}
              onDragOver={onDragOver}
              onDrop={onDrop}
              dragOverId={dragOverId}
            />
          ))}
      </div>
    </div>
  )
}

// ============================================================================
// FolderTree Component - Dropbox-inspired design
// ============================================================================

export function FolderTree({
  folders,
  currentFolderId,
  recentFolders = [],
  onFolderSelect,
  onDragOver,
  onDrop,
  className,
}: FolderTreeProps) {
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set())
  const [focusedId, setFocusedId] = useState<string | null>(null)
  const [dragOverId, setDragOverId] = useState<string | null>(null)

  // Expand parent folders when current folder changes
  useEffect(() => {
    if (!currentFolderId) return

    const expandAncestors = (
      nodes: FolderTreeNode[],
      targetId: string,
      path: string[] = []
    ): string[] | null => {
      for (const node of nodes) {
        if (node.id === targetId) {
          return path
        }
        if (node.children.length > 0) {
          const result = expandAncestors(node.children, targetId, [
            ...path,
            node.id,
          ])
          if (result) return result
        }
      }
      return null
    }

    const path = expandAncestors(folders, currentFolderId)
    if (path) {
      setExpandedIds((prev) => {
        const next = new Set(prev)
        path.forEach((id) => next.add(id))
        return next
      })
    }
  }, [currentFolderId, folders])

  const handleToggle = useCallback((id: string) => {
    setExpandedIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) {
        next.delete(id)
      } else {
        next.add(id)
      }
      return next
    })
  }, [])

  const handleSelect = useCallback(
    (id: string | null) => {
      onFolderSelect(id)
    },
    [onFolderSelect]
  )

  const handleDragOverFolder = useCallback(
    (id: string | null) => {
      setDragOverId(id)
      onDragOver?.(id)
    },
    [onDragOver]
  )

  const handleDropOnFolder = useCallback(
    (id: string | null) => {
      setDragOverId(null)
      onDrop?.(id)
    },
    [onDrop]
  )

  // Global keyboard navigation
  const handleKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault()
      const flatList = flattenVisibleNodes(folders, expandedIds)
      const currentIndex = focusedId
        ? flatList.findIndex((n) => n.id === focusedId)
        : -1

      if (e.key === 'ArrowDown') {
        const nextIndex = Math.min(currentIndex + 1, flatList.length - 1)
        setFocusedId(flatList[nextIndex]?.id ?? null)
      } else {
        const prevIndex = Math.max(currentIndex - 1, 0)
        setFocusedId(flatList[prevIndex]?.id ?? null)
      }
    }
  }

  const isDragOverRoot = dragOverId === 'root'

  return (
    <ScrollArea className={cn('h-full', className)}>
      <div
        className="py-2"
        role="tree"
        aria-label="Mappar"
        tabIndex={0}
        onKeyDown={handleKeyDown}
      >
        {/* Recent folders section */}
        {recentFolders.length > 0 && (
          <div className="mb-4">
            <div className="flex items-center gap-2 px-3 py-1.5 text-xs font-medium text-muted-foreground uppercase tracking-wide">
              <Clock className="h-3 w-3" />
              Senaste
            </div>
            {recentFolders.map((folder) => (
              <button
                key={folder.id}
                type="button"
                className={cn(
                  'w-full flex items-center gap-2 py-1.5 px-3 text-sm rounded-md transition-colors',
                  'hover:bg-accent/60',
                  currentFolderId === folder.id &&
                    'bg-accent font-medium text-accent-foreground'
                )}
                onClick={() => handleSelect(folder.id)}
              >
                <Folder className="h-4 w-4 text-blue-500" />
                <span className="truncate">{folder.name}</span>
              </button>
            ))}
            <div className="my-3 mx-2 border-t border-border" />
          </div>
        )}

        {/* All Files - Root folder */}
        <button
          type="button"
          className={cn(
            'w-full flex items-center gap-2 py-1.5 px-3 text-sm rounded-md transition-all duration-150',
            'hover:bg-accent/60',
            currentFolderId === null &&
              'bg-accent font-medium text-accent-foreground',
            isDragOverRoot && 'ring-2 ring-primary bg-primary/5'
          )}
          onClick={() => handleSelect(null)}
          onDragOver={(e) => {
            e.preventDefault()
            setDragOverId('root')
            onDragOver?.(null)
          }}
          onDragLeave={() => {
            setDragOverId(null)
            onDragOver?.(null)
          }}
          onDrop={(e) => {
            e.preventDefault()
            handleDropOnFolder(null)
          }}
          aria-current={currentFolderId === null ? 'page' : undefined}
        >
          <Home className="h-4 w-4 text-muted-foreground" />
          <span>Alla filer</span>
        </button>

        {/* Folder tree */}
        <div className="mt-1">
          {folders.map((folder) => (
            <FolderTreeNodeItem
              key={folder.id}
              node={folder}
              depth={0}
              currentFolderId={currentFolderId}
              expandedIds={expandedIds}
              focusedId={focusedId}
              onToggle={handleToggle}
              onSelect={handleSelect}
              onFocus={setFocusedId}
              onDragOver={handleDragOverFolder}
              onDrop={handleDropOnFolder}
              dragOverId={dragOverId}
            />
          ))}

          {/* Empty state */}
          {folders.length === 0 && (
            <p className="px-3 py-6 text-sm text-muted-foreground text-center">
              Inga mappar ännu
            </p>
          )}
        </div>
      </div>
    </ScrollArea>
  )
}

// ============================================================================
// Loading Skeleton
// ============================================================================

export function FolderTreeSkeleton() {
  return (
    <div className="py-2 space-y-1">
      <div className="px-3 py-1.5">
        <Skeleton className="h-5 w-20" />
      </div>
      <div className="space-y-0.5">
        <Skeleton className="h-8 w-full rounded-md" />
        <Skeleton className="h-8 w-[85%] ml-4 rounded-md" />
        <Skeleton className="h-8 w-[85%] ml-4 rounded-md" />
        <Skeleton className="h-8 w-full rounded-md" />
        <Skeleton className="h-8 w-[85%] ml-4 rounded-md" />
      </div>
    </div>
  )
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Flatten visible nodes for keyboard navigation
 */
function flattenVisibleNodes(
  nodes: FolderTreeNode[],
  expandedIds: Set<string>
): FolderTreeNode[] {
  const result: FolderTreeNode[] = []

  for (const node of nodes) {
    result.push(node)
    if (expandedIds.has(node.id) && node.children.length > 0) {
      result.push(...flattenVisibleNodes(node.children, expandedIds))
    }
  }

  return result
}
