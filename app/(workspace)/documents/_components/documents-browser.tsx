'use client'

/**
 * Story 6.7b: Documents Browser Component
 * Main file browser with folder tree, breadcrumbs, and file listing
 * Uses SWR for caching and instant back-navigation
 */

import { useState, useCallback, useMemo, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useSWRConfig } from 'swr'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Checkbox } from '@/components/ui/checkbox'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group'
import {
  Grid,
  List,
  Search,
  Upload,
  Trash2,
  FolderOpen,
  FolderPlus,
  ChevronLeft,
  ChevronRight,
  CheckSquare,
  Square,
  Folder,
  SortAsc,
  FileType,
} from 'lucide-react'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'

import { ACCEPTED_TYPES } from '@/components/features/files/file-dropzone'
import {
  FileCard,
  FileCardSkeleton,
  categoryLabels,
} from '@/components/features/files/file-card'
import { FilePreviewPanel } from '@/components/features/files/file-preview-panel'
import { FileLinkModal } from '@/components/features/files/file-link-modal'
import {
  FolderTree,
  FolderTreeSkeleton,
} from '@/components/features/files/folder-tree'
import { FileListView } from '@/components/features/files/file-list-view'
import {
  useFolderTree,
  useFolderContents,
  useFolderPath,
} from '@/lib/hooks/use-files'

import {
  uploadFile,
  deleteFilesBulk,
  updateFilesCategoryBulk,
  createFolder,
  moveItem,
  getFileDownloadUrl,
} from '@/app/actions/files'
import type {
  WorkspaceFileWithLinks,
  FolderTreeNode,
  FolderInfo,
  BreadcrumbSegment,
} from '@/app/actions/files'
import type { FileCategory } from '@prisma/client'

// ============================================================================
// Types
// ============================================================================

interface DocumentsBrowserProps {
  initialFolderId?: string | null
  initialBreadcrumbs?: BreadcrumbSegment[]
}

// ============================================================================
// Component
// ============================================================================

export default function DocumentsBrowser({
  initialFolderId = null,
}: DocumentsBrowserProps) {
  const router = useRouter()
  const { mutate } = useSWRConfig()

  // Folder navigation state
  const [currentFolderId, setCurrentFolderId] = useState<string | null>(
    initialFolderId
  )

  // Filter state
  const [searchQuery, setSearchQuery] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')
  const [categoryFilter, setCategoryFilter] = useState<FileCategory | 'all'>(
    'all'
  )
  const [sortBy, setSortBy] = useState<'name' | 'date' | 'size'>('date')
  const [fileTypeFilter, setFileTypeFilter] = useState<string | 'all'>('all')
  const [page, setPage] = useState(1)

  // View state
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid')
  const [isUploading, setIsUploading] = useState(false)
  const [showSidebar] = useState(true)

  // Selection state
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [showSelection, setShowSelection] = useState(false)

  // Panel state
  const [previewFile, setPreviewFile] = useState<WorkspaceFileWithLinks | null>(
    null
  )
  const [linkFile, setLinkFile] = useState<WorkspaceFileWithLinks | null>(null)

  // New folder dialog
  const [isCreatingFolder, setIsCreatingFolder] = useState(false)
  const [newFolderName, setNewFolderName] = useState('')

  // Drag and drop state
  const [draggedIds, setDraggedIds] = useState<Set<string>>(new Set())
  const [dropTargetId, setDropTargetId] = useState<string | null>(null)

  // Build filters for SWR
  const filters = useMemo(() => {
    const f: { search?: string; category?: FileCategory } = {}
    if (debouncedSearch) f.search = debouncedSearch
    if (categoryFilter !== 'all') f.category = categoryFilter
    return f
  }, [debouncedSearch, categoryFilter])

  // SWR hooks for data fetching with caching
  const {
    folderTree,
    isLoading: isFolderTreeLoading,
    refresh: refreshTree,
  } = useFolderTree()
  const {
    folders,
    files,
    pagination,
    isLoading,
    refresh: refreshContents,
  } = useFolderContents(currentFolderId, { filters, page, limit: 24 })
  const { breadcrumbs } = useFolderPath(currentFolderId, folderTree)

  // Debounced search - updates after 300ms of no typing
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(searchQuery)
      setPage(1)
    }, 300)
    return () => clearTimeout(timer)
  }, [searchQuery])

  // Refresh all caches after mutations
  const refreshAll = useCallback(async () => {
    await Promise.all([
      refreshTree(),
      refreshContents(),
      mutate(
        (key: string) => typeof key === 'string' && key.startsWith('folder-'),
        undefined,
        { revalidate: true }
      ),
    ])
  }, [refreshTree, refreshContents, mutate])

  // Navigate to folder
  const navigateToFolder = useCallback(
    (folderId: string | null) => {
      setCurrentFolderId(folderId)
      setSelectedIds(new Set())
      setPage(1) // Reset to first page

      // Build URL path
      if (folderId === null) {
        router.push('/documents')
      } else {
        // Find path to folder from breadcrumbs or folder tree
        const segment = breadcrumbs.find((b) => b.id === folderId)
        if (segment) {
          router.push(segment.path)
        } else {
          // Build path from folder tree
          const findFolderPath = (
            nodes: FolderTreeNode[],
            targetId: string,
            path: string
          ): string | null => {
            for (const node of nodes) {
              const nodePath = `${path}/${encodeURIComponent(node.name)}`
              if (node.id === targetId) {
                return nodePath
              }
              if (node.children.length > 0) {
                const found = findFolderPath(node.children, targetId, nodePath)
                if (found) return found
              }
            }
            return null
          }
          const folderPath = findFolderPath(folderTree, folderId, '/documents')
          if (folderPath) {
            router.push(folderPath)
          }
        }
      }
    },
    [router, breadcrumbs, folderTree]
  )

  // Upload handler
  const handleUpload = async (filesToUpload: File[]) => {
    setIsUploading(true)
    try {
      for (const file of filesToUpload) {
        const formData = new FormData()
        formData.append('file', file)
        if (currentFolderId) {
          formData.append('parentFolderId', currentFolderId)
        }

        const result = await uploadFile(formData)
        if (!result.success) {
          toast.error(`Kunde inte ladda upp ${file.name}: ${result.error}`)
        }
      }
      refreshAll()
    } finally {
      setIsUploading(false)
    }
  }

  // Create folder
  const handleCreateFolder = async () => {
    if (!newFolderName.trim()) return

    const result = await createFolder({
      name: newFolderName.trim(),
      parentFolderId: currentFolderId,
    })

    if (result.success) {
      toast.success('Mapp skapad')
      setNewFolderName('')
      setIsCreatingFolder(false)
      refreshAll()
    } else {
      toast.error(result.error || 'Kunde inte skapa mapp')
    }
  }

  // Selection handlers
  const toggleSelect = (id: string, selected: boolean) => {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (selected) {
        next.add(id)
      } else {
        next.delete(id)
      }
      return next
    })
  }

  const selectAll = () => {
    const allIds = [...folders.map((f) => f.id), ...files.map((f) => f.id)]
    setSelectedIds(new Set(allIds))
  }

  const clearSelection = () => {
    setSelectedIds(new Set())
    setShowSelection(false)
  }

  // Bulk actions
  const handleBulkDelete = async () => {
    const ids = Array.from(selectedIds)
    if (ids.length === 0) return

    const result = await deleteFilesBulk(ids)
    if (result.success) {
      toast.success(`${result.data?.deleted} fil(er) raderade`)
      clearSelection()
      refreshAll()
    } else {
      toast.error(result.error || 'Kunde inte radera filer')
    }
  }

  const handleBulkCategorize = async (category: FileCategory) => {
    const ids = Array.from(selectedIds)
    if (ids.length === 0) return

    const result = await updateFilesCategoryBulk(ids, category)
    if (result.success) {
      toast.success(`${result.data?.updated} fil(er) uppdaterade`)
      clearSelection()
      refreshAll()
    } else {
      toast.error(result.error || 'Kunde inte uppdatera filer')
    }
  }

  // Drag and drop handlers
  const handleDragStart = useCallback(
    (id: string, e: React.DragEvent) => {
      // If dragging a selected item, drag all selected items
      // Otherwise, just drag the single item
      const idsToMove = selectedIds.has(id)
        ? new Set(selectedIds)
        : new Set([id])

      setDraggedIds(idsToMove)

      // Set drag data for native DnD
      e.dataTransfer.setData(
        'text/plain',
        JSON.stringify(Array.from(idsToMove))
      )
      e.dataTransfer.effectAllowed = 'move'

      // Create custom drag image with count
      if (idsToMove.size > 1) {
        const dragImage = document.createElement('div')
        dragImage.className =
          'bg-primary text-primary-foreground px-3 py-2 rounded-md text-sm font-medium shadow-lg'
        dragImage.textContent = `${idsToMove.size} objekt`
        dragImage.style.position = 'absolute'
        dragImage.style.top = '-1000px'
        document.body.appendChild(dragImage)
        e.dataTransfer.setDragImage(dragImage, 0, 0)
        setTimeout(() => document.body.removeChild(dragImage), 0)
      }
    },
    [selectedIds]
  )

  const handleDragEnd = useCallback(() => {
    setDraggedIds(new Set())
    setDropTargetId(null)
  }, [])

  const handleDragOver = useCallback((folderId: string | null) => {
    setDropTargetId(folderId)
  }, [])

  const handleDrop = async (targetFolderId: string | null) => {
    const ids = Array.from(draggedIds)
    if (ids.length === 0) return

    // Don't allow dropping on self
    if (ids.includes(targetFolderId ?? '')) {
      toast.error('Kan inte flytta en mapp till sig själv')
      setDraggedIds(new Set())
      setDropTargetId(null)
      return
    }

    // Move all dragged items
    let successCount = 0
    let failedCount = 0
    for (const id of ids) {
      const result = await moveItem({ itemId: id, targetFolderId })
      if (result.success) {
        successCount++
      } else {
        failedCount++
      }
    }

    // Show result toast
    if (successCount > 0) {
      toast.success(
        successCount === 1
          ? 'Objekt flyttat'
          : `${successCount} objekt flyttade`,
        {
          action: {
            label: 'Ångra',
            onClick: async () => {
              // Undo by moving back to original folder
              for (const id of ids) {
                await moveItem({ itemId: id, targetFolderId: currentFolderId })
              }
              refreshAll()
            },
          },
        }
      )
    }
    if (failedCount > 0) {
      toast.error(`${failedCount} objekt kunde inte flyttas`)
    }

    // Reset state and reload
    setDraggedIds(new Set())
    setDropTargetId(null)
    clearSelection()
    refreshAll()
  }

  // Pagination handlers
  const goToPage = (newPage: number) => {
    setPage(newPage)
  }

  // Double-click folder to navigate
  const handleFolderDoubleClick = (folder: FolderInfo) => {
    // Build new path
    const currentPath =
      breadcrumbs[breadcrumbs.length - 1]?.path || '/documents'
    const newPath = `${currentPath}/${encodeURIComponent(folder.filename)}`
    router.push(newPath)
    setCurrentFolderId(folder.id)
  }

  return (
    <div className="space-y-6">
      {/* Header - matching tasks page layout */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Mina filer</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Hantera och organisera filer för din organisation.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={() => setIsCreatingFolder(true)}>
            <FolderPlus className="h-4 w-4 mr-2" />
            Ny mapp
          </Button>
          <Button
            onClick={() =>
              document.getElementById('file-upload-input')?.click()
            }
            disabled={isUploading}
          >
            <Upload className="h-4 w-4 mr-2" />
            {isUploading ? 'Laddar upp...' : 'Ladda upp'}
          </Button>
        </div>
      </div>

      {/* Toolbar row - Dropbox-inspired filter chips */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        {/* Search */}
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Sök filer..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9"
          />
        </div>

        {/* Filter chips and view toggle */}
        <div className="flex items-center gap-2 flex-wrap">
          {/* Sort dropdown */}
          <Select
            value={sortBy}
            onValueChange={(v) => setSortBy(v as 'name' | 'date' | 'size')}
          >
            <SelectTrigger className="w-[130px] h-9">
              <SortAsc className="h-4 w-4 mr-2" />
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="date">Senaste</SelectItem>
              <SelectItem value="name">Namn</SelectItem>
              <SelectItem value="size">Storlek</SelectItem>
            </SelectContent>
          </Select>

          {/* Category filter */}
          <Select
            value={categoryFilter}
            onValueChange={(v) => setCategoryFilter(v as FileCategory | 'all')}
          >
            <SelectTrigger className="w-[140px] h-9">
              <SelectValue placeholder="Kategori" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Alla kategorier</SelectItem>
              {(Object.keys(categoryLabels) as FileCategory[]).map((cat) => (
                <SelectItem key={cat} value={cat}>
                  {categoryLabels[cat]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          {/* File type filter */}
          <Select value={fileTypeFilter} onValueChange={setFileTypeFilter}>
            <SelectTrigger className="w-[120px] h-9">
              <FileType className="h-4 w-4 mr-2" />
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Alla typer</SelectItem>
              <SelectItem value="pdf">PDF</SelectItem>
              <SelectItem value="image">Bilder</SelectItem>
              <SelectItem value="document">Dokument</SelectItem>
              <SelectItem value="spreadsheet">Kalkylblad</SelectItem>
            </SelectContent>
          </Select>

          {/* Selection mode and bulk actions */}
          {showSelection && selectedIds.size > 0 ? (
            <div className="flex items-center gap-2 ml-2 pl-2 border-l">
              <span className="text-sm text-muted-foreground">
                {selectedIds.size} valda
              </span>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" size="sm">
                    Åtgärder
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  {(Object.keys(categoryLabels) as FileCategory[]).map(
                    (cat) => (
                      <DropdownMenuItem
                        key={cat}
                        onClick={() => handleBulkCategorize(cat)}
                      >
                        Kategorisera som {categoryLabels[cat]}
                      </DropdownMenuItem>
                    )
                  )}
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    onClick={handleBulkDelete}
                    className="text-destructive"
                  >
                    <Trash2 className="h-4 w-4 mr-2" />
                    Radera valda
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
              <Button variant="ghost" size="sm" onClick={clearSelection}>
                Avbryt
              </Button>
            </div>
          ) : (
            <Button
              variant={showSelection ? 'secondary' : 'outline'}
              size="sm"
              onClick={() => setShowSelection(!showSelection)}
              className="h-9"
            >
              {showSelection ? (
                <CheckSquare className="h-4 w-4 mr-2" />
              ) : (
                <Square className="h-4 w-4 mr-2" />
              )}
              Välj
            </Button>
          )}

          <ToggleGroup
            type="single"
            value={viewMode}
            onValueChange={(v) => v && setViewMode(v as 'grid' | 'list')}
            className="ml-2"
          >
            <ToggleGroupItem
              value="grid"
              aria-label="Rutnätsvy"
              className="h-9 w-9"
            >
              <Grid className="h-4 w-4" />
            </ToggleGroupItem>
            <ToggleGroupItem
              value="list"
              aria-label="Listvy"
              className="h-9 w-9"
            >
              <List className="h-4 w-4" />
            </ToggleGroupItem>
          </ToggleGroup>
        </div>
      </div>

      {/* Hidden file input for uploads */}
      <input
        id="file-upload-input"
        type="file"
        multiple
        accept={ACCEPTED_TYPES.join(',')}
        onChange={async (e) => {
          const files = Array.from(e.target.files ?? [])
          if (files.length > 0) {
            await handleUpload(files)
          }
          e.target.value = ''
        }}
        className="hidden"
      />

      {/* Main content area with folder tree sidebar */}
      <div className="flex gap-6">
        {/* Folder tree sidebar - full height like Dropbox */}
        {showSidebar && (
          <div className="w-64 flex-shrink-0 self-stretch">
            <div className="sticky top-4 border rounded-lg bg-card p-2 h-[calc(100vh-12rem)]">
              {isFolderTreeLoading ? (
                <FolderTreeSkeleton />
              ) : (
                <FolderTree
                  folders={folderTree}
                  currentFolderId={currentFolderId}
                  onFolderSelect={navigateToFolder}
                  onDragOver={handleDragOver}
                  onDrop={handleDrop}
                  className="h-full"
                />
              )}
            </div>
          </div>
        )}

        {/* File content area */}
        <div className="flex-1 min-w-0">
          {/* New folder input */}
          {isCreatingFolder && (
            <div className="flex items-center gap-2 mb-4 p-3 bg-muted rounded-lg">
              <Folder className="h-5 w-5 text-amber-500" />
              <Input
                placeholder="Mappnamn"
                value={newFolderName}
                onChange={(e) => setNewFolderName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleCreateFolder()
                  if (e.key === 'Escape') setIsCreatingFolder(false)
                }}
                ref={(input) => input?.focus()}
                className="flex-1"
              />
              <Button size="sm" onClick={handleCreateFolder}>
                Skapa
              </Button>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => setIsCreatingFolder(false)}
              >
                Avbryt
              </Button>
            </div>
          )}

          {/* Content */}
          {isLoading ? (
            <div
              className="grid gap-5"
              style={{
                gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
              }}
            >
              {Array.from({ length: 8 }).map((_, i) => (
                <FileCardSkeleton key={i} />
              ))}
            </div>
          ) : folders.length === 0 && files.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <FolderOpen className="h-16 w-16 text-muted-foreground/30 mb-4" />
              <h3 className="text-lg font-medium">Tom mapp</h3>
              <p className="text-sm text-muted-foreground mt-1 mb-4">
                Ladda upp filer eller skapa en ny mapp för att komma igång.
              </p>
              <Button
                variant="outline"
                onClick={() =>
                  document.getElementById('file-upload-input')?.click()
                }
              >
                <Upload className="h-4 w-4 mr-2" />
                Ladda upp filer
              </Button>
            </div>
          ) : viewMode === 'grid' ? (
            <div
              className="grid gap-5"
              style={{
                gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
              }}
            >
              {/* Folders - Dropbox-inspired design */}
              {folders.map((folder) => (
                <button
                  type="button"
                  key={folder.id}
                  draggable
                  onDragStart={(e) => handleDragStart(folder.id, e)}
                  onDragEnd={handleDragEnd}
                  onDragOver={(e) => {
                    e.preventDefault()
                    handleDragOver(folder.id)
                  }}
                  onDragLeave={() => handleDragOver(null)}
                  onDrop={(e) => {
                    e.preventDefault()
                    handleDrop(folder.id)
                  }}
                  className={cn(
                    'group relative flex flex-col rounded-lg border bg-card cursor-pointer transition-all duration-200 text-left overflow-hidden aspect-square',
                    'hover:shadow-lg hover:border-primary/30 hover:-translate-y-0.5',
                    'border-transparent',
                    selectedIds.has(folder.id) &&
                      'ring-2 ring-primary shadow-md',
                    draggedIds.has(folder.id) && 'opacity-50 scale-95',
                    dropTargetId === folder.id &&
                      'ring-2 ring-primary bg-primary/5'
                  )}
                  onClick={() =>
                    showSelection &&
                    toggleSelect(folder.id, !selectedIds.has(folder.id))
                  }
                  onDoubleClick={() => handleFolderDoubleClick(folder)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') handleFolderDoubleClick(folder)
                  }}
                >
                  {/* Folder thumbnail area - takes most of the square */}
                  <div className="relative flex-1 w-full bg-gradient-to-br from-blue-50 to-blue-100 dark:from-blue-950/30 dark:to-blue-900/20 flex items-center justify-center">
                    {showSelection && (
                      <Checkbox
                        checked={selectedIds.has(folder.id)}
                        onCheckedChange={(checked) =>
                          toggleSelect(folder.id, !!checked)
                        }
                        className={cn(
                          'absolute top-3 left-3 h-5 w-5 bg-background/90 border-2 z-10 transition-opacity',
                          selectedIds.has(folder.id)
                            ? 'opacity-100'
                            : 'opacity-0 group-hover:opacity-100'
                        )}
                        onClick={(e) => e.stopPropagation()}
                      />
                    )}
                    <Folder className="h-16 w-16 text-blue-500" />
                  </div>

                  {/* Folder name - fixed height at bottom */}
                  <div className="w-full p-3 flex-shrink-0">
                    <span className="text-sm font-medium truncate block">
                      {folder.filename}
                    </span>
                  </div>
                </button>
              ))}

              {/* Files */}
              {files.map((file) => (
                <FileCard
                  key={file.id}
                  file={file}
                  selected={selectedIds.has(file.id)}
                  onSelect={toggleSelect}
                  onClick={setPreviewFile}
                  showSelection={showSelection}
                  draggable
                  isDragging={draggedIds.has(file.id)}
                  onDragStart={(e) => handleDragStart(file.id, e)}
                  onDragEnd={handleDragEnd}
                />
              ))}
            </div>
          ) : (
            <FileListView
              folders={folders}
              files={files}
              selectedIds={selectedIds}
              showSelection={showSelection}
              onFolderDoubleClick={handleFolderDoubleClick}
              onFileClick={setPreviewFile}
              onToggleSelect={toggleSelect}
              onSelectAll={selectAll}
              onClearSelection={clearSelection}
              getFileUrl={async (file) => {
                const result = await getFileDownloadUrl(file.id)
                return result.success && result.data?.url
                  ? result.data.url
                  : null
              }}
            />
          )}

          {/* Pagination */}
          {pagination.totalPages > 1 && (
            <div className="flex items-center justify-between mt-4">
              <p className="text-sm text-muted-foreground">
                Visar {(pagination.page - 1) * pagination.limit + 1}-
                {Math.min(pagination.page * pagination.limit, pagination.total)}{' '}
                av {pagination.total} filer
              </p>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => goToPage(pagination.page - 1)}
                  disabled={!pagination.hasPrev}
                >
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <span className="text-sm">
                  Sida {pagination.page} av {pagination.totalPages}
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => goToPage(pagination.page + 1)}
                  disabled={!pagination.hasNext}
                >
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Preview Panel */}
      <FilePreviewPanel
        file={previewFile}
        open={!!previewFile}
        onOpenChange={(open) => !open && setPreviewFile(null)}
        onUpdate={refreshAll}
        onDelete={refreshAll}
        onLinkClick={(file) => {
          setPreviewFile(null)
          setLinkFile(file)
        }}
      />

      {/* Link Modal */}
      <FileLinkModal
        file={linkFile}
        open={!!linkFile}
        onOpenChange={(open) => !open && setLinkFile(null)}
        onUpdate={() => {
          refreshAll()
          if (previewFile && linkFile && previewFile.id === linkFile.id) {
            const updatedFile = files.find((f) => f.id === linkFile.id)
            if (updatedFile) setPreviewFile(updatedFile)
          }
        }}
      />
    </div>
  )
}
